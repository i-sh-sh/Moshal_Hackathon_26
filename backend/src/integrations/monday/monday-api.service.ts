/**
 * Monday.com GraphQL client.
 *
 * All outbound requests go through GatekeeperService — never call `fetch`
 * directly outside of `gatekeeper.execute(...)`.
 *
 * Gracefully no-ops when MONDAY_API_TOKEN is unset, so local dev and the
 * mock-monday simulator can run end-to-end without a Monday workspace.
 *
 * @version 1.10
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

interface GraphQLResponse<T> {
    data: T;
    errors?: { message: string }[];
}

class HttpStatusError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'HttpStatusError';
    }
}

@Injectable()
export class MondayApiService {
    private readonly logger = new Logger(MondayApiService.name);
    private readonly apiUrl = 'https://api.monday.com/v2';
    private readonly token: string;

    constructor(
        private readonly config: ConfigService,
        private readonly gatekeeper: GatekeeperService,
    ) {
        this.token = this.config.integrations.mondayApiToken;
        if (!this.token) {
            this.logger.warn('MONDAY_API_TOKEN not set — Monday calls will no-op');
        }
    }

    async updateItemStatus(itemId: number, statusLabel: string): Promise<void> {
        if (!this.token) return;
        const gql = `
            mutation {
                change_simple_column_value(
                    item_id: ${itemId},
                    column_id: "status",
                    value: ${JSON.stringify(statusLabel)}
                ) { id }
            }
        `;
        try {
            await this.run(gql);
            this.logger.log(`Monday item ${itemId} → "${statusLabel}"`);
        } catch (err) {
            this.logger.error(
                `Failed to update Monday item ${itemId}`,
                (err as Error).message,
            );
        }
    }

    async createItem(
        boardId: number,
        groupId: string,
        itemName: string,
    ): Promise<number | null> {
        if (!this.token) return null;
        const gql = `
            mutation {
                create_item(
                    board_id: ${boardId},
                    group_id: ${JSON.stringify(groupId)},
                    item_name: ${JSON.stringify(itemName)}
                ) { id }
            }
        `;
        try {
            const data = await this.run<{ create_item: { id: string } }>(gql);
            return parseInt(data.create_item.id, 10);
        } catch (err) {
            this.logger.error('Failed to create Monday item', (err as Error).message);
            return null;
        }
    }

    private async run<T>(gql: string): Promise<T> {
        return this.gatekeeper.execute('monday', async () => {
            const res = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.token,
                },
                body: JSON.stringify({ query: gql }),
            });
            if (!res.ok) {
                throw new HttpStatusError(res.status, `Monday HTTP ${res.status}`);
            }
            const json = (await res.json()) as GraphQLResponse<T>;
            if (json.errors?.length) {
                throw new Error(
                    `Monday GraphQL: ${json.errors.map((e) => e.message).join(', ')}`,
                );
            }
            return json.data;
        });
    }
}
