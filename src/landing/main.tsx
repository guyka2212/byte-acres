import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito-sans/wght.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '../styles/app.css'
import { LandingPage } from './LandingPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
)
