import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
/** URL is the source of truth, including browser back/forward and shared links. */
export function useQueryState(key: string, fallback = '') {
  const route = useRoute(),
    router = useRouter()
  return computed({
    get: () => (typeof route.query[key] === 'string' ? (route.query[key] as string) : fallback),
    set: (value) => {
      const query = { ...route.query }
      if (!value || value === fallback) delete query[key]
      else query[key] = value
      void router.replace({ query })
    },
  })
}
