import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadPublished } from '../contentStore'
import { useStore } from '../store'
import { Studio } from './Studio'
import '../styles.css'
import '../game.css'
import '../journey.css'
import '../challenge.css'
import './studio.css'

// previews in the studio use the game's own windows, but must never touch the player's journey on this device
useStore.setState({
  finishQuiz: (id) => useStore.setState({ stationQuiz: null, stampAward: id }),
  solveRiddle: () => {},
  showToast: () => {},
})

loadPublished().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Studio />
    </StrictMode>,
  ),
)
