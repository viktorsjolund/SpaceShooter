import { UpgradeMenu } from '../pages/upgrades'
import { Canvas } from '../pages/canvas'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { Home } from '../pages/home'
import { Levels } from '../pages/levels'
import { LevelPicker } from '../logic/level-picker'
import { Login } from '../pages/login'
import { Register } from '../pages/register'
import { Characters } from '../pages/characters'
import { CharacterPicker } from '../logic/character-picker'
import { AudioHandler } from '../misc/audio-handler'
import { PlayerLevelHandler } from '../logic/player-level-handler'
import { TAppRouterProps } from '../types/types'
import { Leaderboard } from '../pages/leaderboard'
import { UpgradesHandler } from '../logic/upgrade-logic/upgrades-handler'
import { useEffect, useMemo } from 'react'

export const AppRouter = (props: TAppRouterProps) => {
  const levelPicker = new LevelPicker()
  const characterPicker = new CharacterPicker()
  const audioHandler = useMemo(() => new AudioHandler(), [])
  const playerLevelHandler = new PlayerLevelHandler()
  const upgradesHandler = new UpgradesHandler(props.client)

  useEffect(() => {
    audioHandler.playThemeSong()
    const listener = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.nodeName === 'A' || target.nodeName === 'BUTTON') {
        audioHandler.playClickSound()
      }
    }

    window.addEventListener('click', listener)

    return () => {
      window.removeEventListener('click', listener)
    }
  }, [audioHandler])

  return (
    <Router>
      <Routes>
        <Route
          path='/'
          element={
            <Home
              lvlhandler={playerLevelHandler}
              audiohandler={audioHandler}
            />
          }
        />
        <Route
          path='/play'
          element={
            <Canvas
              lvlpicker={levelPicker}
              charpicker={characterPicker}
              client={props.client}
              audiohandler={audioHandler}
            />
          }
        />
        <Route
          path='/upgrades'
          element={
            <UpgradeMenu
              lvlhandler={playerLevelHandler}
              charpicker={characterPicker}
              audiohandler={audioHandler}
              upgradesHandler={upgradesHandler}
            />
          }
        />
        <Route
          path='/levels'
          element={
            <Levels
              lvlpicker={levelPicker}
            />
          }
        />
        <Route
          path='login'
          element={<Login client={props.client} />}
        />
        <Route
          path='register'
          element={<Register />}
        />
        <Route
          path='characters'
          element={
            <Characters
              charpicker={characterPicker}
              lvlhandler={playerLevelHandler}
            />
          }
        />
        <Route
          path='leaderboard'
          element={
            <Leaderboard
              lvlhandler={playerLevelHandler}
            />
          }
        />
      </Routes>
    </Router>
  )
}
