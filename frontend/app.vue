<template>
  <NuxtPage />
</template>

<style>
/* ── Base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: 'Heebo', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: #f9fafb;
  color: #111827;
}

/* ── Buttons ──────────────────────────────────────── */
.btn {
  @apply inline-flex items-center justify-center gap-2 font-semibold rounded-xl
         transition-all duration-150 cursor-pointer select-none
         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed;
}
.btn-sm  { @apply text-xs  px-3   py-1.5; }
.btn-md  { @apply text-sm  px-4   py-2;   }
.btn-lg  { @apply text-sm  px-5   py-2.5; }

.btn-primary { @apply bg-[#3CC2EE] hover:bg-[#2ba9d4] active:bg-[#1e8db4] text-white focus-visible:ring-[#3CC2EE] shadow-sm; }
.btn-ghost   { @apply bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-600 focus-visible:ring-gray-300; }
.btn-danger  { @apply bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus-visible:ring-red-400 shadow-sm; }
.btn-success { @apply bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white focus-visible:ring-emerald-400 shadow-sm; }
.btn-warning { @apply bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white focus-visible:ring-amber-400 shadow-sm; }
.btn-indigo  { @apply bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white focus-visible:ring-indigo-400 shadow-sm; }
.btn-outline { @apply border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 focus-visible:ring-gray-300; }

/* ── Cards ────────────────────────────────────────── */
.card {
  @apply bg-white rounded-2xl border border-gray-200;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04);
}
.card-hover {
  @apply card transition-all duration-200 hover:border-gray-300;
  &:hover { box-shadow: 0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04); }
}

/* ── Status badges ────────────────────────────────── */
.badge {
  @apply inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full;
}
.badge-pending  { @apply bg-gray-100    text-gray-600;   }
.badge-qa       { @apply bg-amber-100   text-amber-700;  }
.badge-pm       { @apply bg-blue-100    text-blue-700;   }
.badge-teacher  { @apply bg-purple-100  text-purple-700; }
.badge-approved { @apply bg-emerald-100 text-emerald-700; }
.badge-rejected { @apply bg-red-100     text-red-600;    }

/* ── Form inputs ──────────────────────────────────── */
.input {
  @apply w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
         bg-white text-gray-900 placeholder-gray-400
         focus:outline-none focus:ring-2 focus:ring-[#3CC2EE] focus:border-transparent
         transition-shadow;
}

/* ── Spinner ──────────────────────────────────────── */
.spinner {
  @apply rounded-full animate-spin;
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid #d0f4ff;
  border-top-color: #3CC2EE;
}
</style>
