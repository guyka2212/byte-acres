import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito-sans/wght.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/app.css'
import { DesignPage } from './design/DesignPage'
import { GameScreen } from './ui/game/GameScreen'
import { HomeScreen } from './ui/home/HomeScreen'
import { ClassScreen } from './ui/home/ClassScreen'
import { AuthScreen } from './ui/home/AuthScreen'
import { SettingsPage } from './ui/home/SettingsPage'
import { FieldSettingsPage } from './ui/home/FieldSettingsPage'
import { account, cloudConfigured } from './cloud/account'
import { fieldFromSlot, setActiveSlot } from './save/fields'

function Root() {
  const [hash, setHash] = useState(location.hash)
  const acct = useSyncExternalStore(account.subscribe, account.getState)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    addEventListener('hashchange', onHash)
    void account.start()
    return () => removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/design') return <DesignPage />
  // every player has an account; only a build without one (development, the offline test build) plays without
  if (cloudConfigured && acct.status !== 'signed-in') {
    if (acct.status === 'loading') return <p className="grid h-full place-items-center text-sm text-muted">Opening Byte Acres…</p>
    return <AuthScreen mode={hash === '#/signin' ? 'signin' : 'signup'} />
  }
  if (hash === '#/settings') return <SettingsPage />
  const fieldSettings = /^#\/field\/([\w-]{1,80})$/.exec(hash)
  if (fieldSettings) return <FieldSettingsPage key={fieldSettings[1]} slot={fieldSettings[1]} />
  const cls = /^#\/class\/([0-9a-f-]{36})$/.exec(hash)
  if (cls) return <ClassScreen key={cls[1]} id={cls[1]} />
  const play = /^#\/play\/([\w-]{1,80})$/.exec(hash)
  if (play) {
    setActiveSlot(play[1])
    return <GameScreen key={play[1]} field={fieldFromSlot(play[1])} />
  }
  // everything else, including signing in or up again: the home screen for this kind of account
  return <HomeScreen />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
