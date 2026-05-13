import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import LogsWindowApp from './LogsWindowApp.tsx'
import UpdateProgressApp from './UpdateProgressApp.tsx'
import { isLogsWindowMode } from './logsUrl'
import { isUpdateProgressMode } from './updateProgressUrl'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

const altWindow = isLogsWindowMode() || isUpdateProgressMode()

createRoot(document.getElementById('root')!).render(
  altWindow ? (
    <QueryClientProvider client={queryClient}>
      {isLogsWindowMode() ? <LogsWindowApp /> : <UpdateProgressApp />}
    </QueryClientProvider>
  ) : (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  ),
)
