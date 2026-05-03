<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        term: string;
        translation?: string;
    }>(),
    { translation: undefined },
);

// Built-in glossary — extend as the product grows
const glossary: Record<string, string> = {
    'Submit': 'שלח / הגש',
    'Pending': 'ממתין לאישור',
    'Approved': 'אושר',
    'Rejected': 'נדחה',
    'Sprint': 'ספרינט (מחזור פיתוח קצר)',
    'Product Manager': 'מנהל המוצר',
    'PM': 'מנהל מוצר (Product Manager)',
    'QA': 'בדיקות איכות (Quality Assurance)',
    'Dev': 'מפתח (Developer)',
    'Hardware': 'חומרה',
    'Review': 'סקירה / בדיקה',
    'Checklist': 'רשימת בדיקה',
    'Deadline': 'מועד אחרון',
    'Backlog': 'רשימת משימות ממתינות',
    'Stakeholder': 'בעל עניין',
    'Feedback': 'משוב',
    'Deployment': 'פרסום / העלאה לאוויר',
    'Bug': 'תקלה בתוכנה',
    'Feature': 'פיצ\'ר / יכולת חדשה',
    'Merge': 'מיזוג קוד',
    'Pull Request': 'בקשת משיכה לאיחוד קוד',
    'Stand-up': 'פגישת סטנד-אפ יומית',
    'Milestone': 'אבן דרך',
    'Deliverable': 'תוצרת / פלט',
    'MVP': 'מוצר מינימלי (Minimum Viable Product)',
    'Agile': 'מתודולוגיית אג\'ייל',
    'Scrum': 'מסגרת סקראם',
    'Kanban': 'לוח קנבן',
};

const resolvedTranslation = computed(
    () => props.translation ?? glossary[props.term] ?? null,
);

const isVisible = ref(false);
</script>

<template>
    <span
        class="english-term"
        @mouseenter="isVisible = true"
        @mouseleave="isVisible = false"
        @focusin="isVisible = true"
        @focusout="isVisible = false"
        tabindex="0"
        role="term"
        :aria-label="resolvedTranslation ? `${term} — ${resolvedTranslation}` : term"
    >
        <span class="term-text">{{ term }}</span>

        <Transition name="tooltip-fade">
            <span
                v-if="isVisible && resolvedTranslation"
                class="tooltip"
                role="tooltip"
            >
                {{ resolvedTranslation }}
            </span>
        </Transition>
    </span>
</template>

<style scoped>
.english-term {
    position: relative;
    display: inline-block;
    cursor: help;
}

.term-text {
    border-bottom: 1px dashed currentColor;
    opacity: 0.9;
}

.tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    color: #f1f5f9;
    font-size: 0.78rem;
    font-family: inherit;
    white-space: nowrap;
    padding: 4px 10px;
    border-radius: 6px;
    pointer-events: none;
    z-index: 50;
    direction: rtl;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

/* Arrow */
.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1e293b;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
}
</style>
