<script setup lang="ts">
import type { Task, TaskStatus, UserRole, QaChecklist } from '~/types/types';

const props = defineProps<{
    tasks: Task[];
    currentRole: UserRole;
    userId: string;
    teamId: string;
}>();

const emit = defineEmits<{
    (e: 'submit-task', payload: { taskId: string; submissionUrl: string; submissionImageUrl: string }): void;
    (e: 'qa-review', payload: { taskId: string; decision: 'approve' | 'reject'; checklist: QaChecklist; notes: string }): void;
    (e: 'pm-review', payload: { taskId: string; decision: 'approve' | 'reject'; notes: string }): void;
    (e: 'request-hint', payload: { taskId: string; taskDescription: string }): void;
}>();

// ── Active modal state ────────────────────────────────────────────────────────
const activeTaskId = ref<string | null>(null);
const activeModal = ref<'submit' | 'qa' | 'pm' | 'hint' | null>(null);

function openModal(taskId: string, modal: typeof activeModal.value) {
    activeTaskId.value = taskId;
    activeModal.value = modal;
    resetForms();
}
function closeModal() {
    activeTaskId.value = null;
    activeModal.value = null;
}

// ── Submit form ───────────────────────────────────────────────────────────────
const submitUrl = ref('');
const submitImageUrl = ref('');

function handleSubmit() {
    if (!activeTaskId.value) return;
    emit('submit-task', {
        taskId: activeTaskId.value,
        submissionUrl: submitUrl.value,
        submissionImageUrl: submitUrl.value,
    });
    closeModal();
}

// ── QA review form ────────────────────────────────────────────────────────────
const qaChecklist = reactive<QaChecklist>({
    isCompleted: false,
    hasErrors: false,
    improvements: [],
});
const qaImprovementInput = ref('');
const qaNotes = ref('');

function addImprovement() {
    const val = qaImprovementInput.value.trim();
    if (val) {
        qaChecklist.improvements.push(val);
        qaImprovementInput.value = '';
    }
}
function removeImprovement(i: number) {
    qaChecklist.improvements.splice(i, 1);
}

function handleQaReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    emit('qa-review', {
        taskId: activeTaskId.value,
        decision,
        checklist: { ...qaChecklist, improvements: [...qaChecklist.improvements] },
        notes: qaNotes.value,
    });
    closeModal();
}

// ── PM review form ────────────────────────────────────────────────────────────
const pmNotes = ref('');

function handlePmReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    emit('pm-review', {
        taskId: activeTaskId.value,
        decision,
        notes: pmNotes.value,
    });
    closeModal();
}

// ── Hint ─────────────────────────────────────────────────────────────────────
function handleRequestHint(task: Task) {
    emit('request-hint', { taskId: task.id, taskDescription: task.description ?? task.title });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function resetForms() {
    submitUrl.value = '';
    submitImageUrl.value = '';
    qaChecklist.isCompleted = false;
    qaChecklist.hasErrors = false;
    qaChecklist.improvements = [];
    qaImprovementInput.value = '';
    qaNotes.value = '';
    pmNotes.value = '';
}

const statusLabels: Record<TaskStatus, string> = {
    pending: 'Pending',
    qa_review: 'QA Review',
    pm_review: 'PM Review',
    teacher_review: 'Teacher Review',
    approved: 'Approved',
    rejected: 'Rejected',
};

const statusColors: Record<TaskStatus, string> = {
    pending: 'bg-gray-100 text-gray-700',
    qa_review: 'bg-yellow-100 text-yellow-800',
    pm_review: 'bg-blue-100 text-blue-800',
    teacher_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};

function canSubmit(task: Task): boolean {
    return (
        (props.currentRole === 'dev' || props.currentRole === 'hardware') &&
        (task.status === 'pending' || task.status === 'rejected')
    );
}
function canQaReview(task: Task): boolean {
    return props.currentRole === 'qa' && task.status === 'qa_review';
}
function canPmReview(task: Task): boolean {
    return props.currentRole === 'pm' && task.status === 'pm_review';
}
function canRequestHint(task: Task): boolean {
    return task.status !== 'approved' && task.status !== 'teacher_review';
}

const activeTask = computed(() =>
    props.tasks.find((t) => t.id === activeTaskId.value) ?? null,
);
</script>

<template>
    <div class="task-board">
        <!-- ── Empty state ─────────────────────────────────────────── -->
        <div v-if="tasks.length === 0" class="text-center py-16 text-gray-400">
            No tasks assigned yet.
        </div>

        <!-- ── Task grid ──────────────────────────────────────────────── -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article
                v-for="task in tasks"
                :key="task.id"
                class="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col p-4 gap-3"
            >
                <!-- Header -->
                <div class="flex items-start justify-between gap-2">
                    <h3 class="font-semibold text-gray-800 text-sm leading-snug">
                        {{ task.title }}
                    </h3>
                    <span
                        :class="['text-xs font-medium px-2 py-0.5 rounded-full shrink-0', statusColors[task.status]]"
                    >
                        <EnglishTerm :term="statusLabels[task.status]" />
                    </span>
                </div>

                <!-- Description -->
                <p v-if="task.description" class="text-xs text-gray-500 leading-relaxed">
                    {{ task.description }}
                </p>

                <!-- Role badge -->
                <div class="text-xs text-gray-400">
                    Role:
                    <EnglishTerm
                        :term="task.assignedRole === 'pm' ? 'PM' : task.assignedRole.toUpperCase()"
                    />
                </div>

                <!-- Action buttons — role-aware -->
                <div class="mt-auto flex flex-wrap gap-2">
                    <!-- Dev / Hardware: Submit -->
                    <button
                        v-if="canSubmit(task)"
                        class="btn btn-primary"
                        @click="openModal(task.id, 'submit')"
                    >
                        <EnglishTerm term="Submit" /> Work
                    </button>

                    <!-- QA: Review -->
                    <button
                        v-if="canQaReview(task)"
                        class="btn btn-yellow"
                        @click="openModal(task.id, 'qa')"
                    >
                        QA <EnglishTerm term="Review" />
                    </button>

                    <!-- PM: Review -->
                    <button
                        v-if="canPmReview(task)"
                        class="btn btn-blue"
                        @click="openModal(task.id, 'pm')"
                    >
                        <EnglishTerm term="PM" /> <EnglishTerm term="Review" />
                    </button>

                    <!-- Hint (always available while task is open) -->
                    <button
                        v-if="canRequestHint(task)"
                        class="btn btn-ghost ml-auto"
                        title="Ask for a hint"
                        @click="handleRequestHint(task)"
                    >
                        💡 Hint
                    </button>
                </div>
            </article>
        </div>

        <!-- ════════════════════════════════════════════════════════════
             Modal overlay
        ════════════════════════════════════════════════════════════ -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div
                    v-if="activeModal && activeTask"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    @click.self="closeModal"
                >
                    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">

                        <!-- ── Submit modal ──────────────────────────────── -->
                        <template v-if="activeModal === 'submit'">
                            <h2 class="text-lg font-bold">
                                <EnglishTerm term="Submit" /> Work
                            </h2>
                            <label class="field">
                                <span>Submission URL</span>
                                <input v-model="submitUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <label class="field">
                                <span>Image URL <span class="text-gray-400">(optional)</span></span>
                                <input v-model="submitImageUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" @click="closeModal">Cancel</button>
                                <button class="btn btn-primary" @click="handleSubmit">
                                    <EnglishTerm term="Submit" />
                                </button>
                            </div>
                        </template>

                        <!-- ── QA Review modal ───────────────────────────── -->
                        <template v-else-if="activeModal === 'qa'">
                            <h2 class="text-lg font-bold">QA <EnglishTerm term="Review" /></h2>

                            <div class="flex flex-col gap-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.isCompleted" type="checkbox" />
                                    Task requirements completed?
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.hasErrors" type="checkbox" />
                                    Errors found?
                                </label>
                            </div>

                            <div class="field">
                                <span class="label">Improvements</span>
                                <div class="flex gap-2">
                                    <input
                                        v-model="qaImprovementInput"
                                        class="input flex-1"
                                        placeholder="Add an improvement note..."
                                        @keyup.enter="addImprovement"
                                    />
                                    <button class="btn btn-ghost" @click="addImprovement">+</button>
                                </div>
                                <ul v-if="qaChecklist.improvements.length" class="mt-1 space-y-1">
                                    <li
                                        v-for="(imp, i) in qaChecklist.improvements"
                                        :key="i"
                                        class="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                                    >
                                        {{ imp }}
                                        <button class="text-red-400 hover:text-red-600 ml-2" @click="removeImprovement(i)">✕</button>
                                    </li>
                                </ul>
                            </div>

                            <label class="field">
                                <span>Notes</span>
                                <textarea v-model="qaNotes" class="input" rows="2" placeholder="Optional notes..." />
                            </label>

                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" @click="closeModal">Cancel</button>
                                <button class="btn btn-red" @click="handleQaReview('reject')">Reject</button>
                                <button class="btn btn-green" @click="handleQaReview('approve')">
                                    <EnglishTerm term="Approved" />
                                </button>
                            </div>
                        </template>

                        <!-- ── PM Review modal ───────────────────────────── -->
                        <template v-else-if="activeModal === 'pm'">
                            <h2 class="text-lg font-bold">
                                <EnglishTerm term="Product Manager" /> <EnglishTerm term="Review" />
                            </h2>

                            <div v-if="activeTask.qaChecklist" class="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                                <p class="font-semibold text-gray-600">QA Checklist Summary</p>
                                <p>✅ Completed: {{ activeTask.qaChecklist.isCompleted ? 'Yes' : 'No' }}</p>
                                <p>🐛 Errors: {{ activeTask.qaChecklist.hasErrors ? 'Yes' : 'No' }}</p>
                                <p v-if="activeTask.qaChecklist.improvements.length">
                                    📝 Improvements: {{ activeTask.qaChecklist.improvements.join(', ') }}
                                </p>
                                <p v-if="activeTask.qaNotes">💬 QA notes: {{ activeTask.qaNotes }}</p>
                            </div>

                            <label class="field">
                                <span>PM Notes</span>
                                <textarea v-model="pmNotes" class="input" rows="2" placeholder="Add your notes..." />
                            </label>

                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" @click="closeModal">Cancel</button>
                                <button class="btn btn-red" @click="handlePmReview('reject')">Reject → QA</button>
                                <button class="btn btn-green" @click="handlePmReview('approve')">
                                    <EnglishTerm term="Approved" /> → Teacher
                                </button>
                            </div>
                        </template>

                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
/* Utility button classes — Tailwind @apply not available in scoped without config */
.btn {
    @apply inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1;
}
.btn-primary { @apply bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500; }
.btn-yellow  { @apply bg-yellow-400 text-yellow-900 hover:bg-yellow-500 focus:ring-yellow-400; }
.btn-blue    { @apply bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400; }
.btn-green   { @apply bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400; }
.btn-red     { @apply bg-red-500 text-white hover:bg-red-600 focus:ring-red-400; }
.btn-ghost   { @apply bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300; }

.field { @apply flex flex-col gap-1 text-sm text-gray-700; }
.label { @apply text-sm text-gray-700; }
.input { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400; }

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to    { opacity: 0; }
</style>
