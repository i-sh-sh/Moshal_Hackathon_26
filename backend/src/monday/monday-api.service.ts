import { Injectable, Logger } from '@nestjs/common';

interface GraphQLResponse<T> {
    data: T;
    errors?: { message: string }[];
}

@Injectable()
export class MondayApiService {
    private readonly logger = new Logger(MondayApiService.name);
    private readonly apiUrl = 'https://api.monday.com/v2';

    private get token(): string {
        return process.env.MONDAY_API_TOKEN ?? '';
    }

    private async query<T>(gql: string): Promise<T> {
        if (!this.token) {
            this.logger.warn('MONDAY_API_TOKEN not set — skipping Monday API call');
            return {} as T;
        }

        const res = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: this.token,
            },
            body: JSON.stringify({ query: gql }),
        });

        if (!res.ok) {
            throw new Error(`Monday HTTP ${res.status}: ${res.statusText}`);
        }

        const json = (await res.json()) as GraphQLResponse<T>;

        if (json.errors?.length) {
            throw new Error(`Monday GraphQL: ${json.errors.map((e) => e.message).join(', ')}`);
        }

        return json.data;
    }

    async updateItemStatus(itemId: number, statusLabel: string): Promise<void> {
        const gql = `
            mutation {
                change_simple_column_value(
                    item_id: ${itemId},
                    column_id: "status",
                    value: "${statusLabel}"
                ) { id }
            }
        `;

        try {
            await this.query(gql);
            this.logger.log(`Monday item ${itemId} → "${statusLabel}"`);
        } catch (err) {
            this.logger.error(`Failed to update Monday item ${itemId}`, (err as Error).message);
        }
    }

    async createItem(
        boardId: number,
        groupId: string,
        itemName: string,
    ): Promise<number | null> {
        const gql = `
            mutation {
                create_item(
                    board_id: ${boardId},
                    group_id: "${groupId}",
                    item_name: "${itemName}"
                ) { id }
            }
        `;

        try {
            const data = await this.query<{ create_item: { id: string } }>(gql);
            return parseInt(data.create_item.id, 10);
        } catch (err) {
            this.logger.error('Failed to create Monday item', (err as Error).message);
            return null;
        }
    }
}
