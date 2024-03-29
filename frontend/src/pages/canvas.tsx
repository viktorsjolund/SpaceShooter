import { useEffect, useRef, useState } from 'react'
import { Game } from '../logic/game'
import { GameState } from '../logic/util/enums'
import { GameOver } from '../components/game-over'
import { GameWon } from '../components/game-won'
import { Paused } from '../components/paused'
import { Navigate } from 'react-router-dom'
import { useMeQuery } from '../generated/graphql'
import { TGameCanvasProps, TStateChangeCb } from '@/types/types'
import { Loading } from '../components/loading'

export const Canvas = (props: TGameCanvasProps) => {
  const { loading, data } = useMeQuery()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  let isRunning = false
  const [gamestate, setGamestate] = useState(GameState.Playing)

  const initNewGame = () => {
    setGamestate(GameState.Playing)
    if (!isRunning) {
      const newGame = new Game(
        props.lvlpicker,
        {
          canvas: canvasRef.current!,
          ctx: canvasRef.current!.getContext('2d')!
        },
        props.charpicker,
        props.client,
        handleGameStateChange,
        props.audiohandler
      )
      newGame.play()
      setGame(newGame)
      isRunning = true
    }
  }

  const handleGameStateChange: TStateChangeCb = (state) => {
    setGamestate(state)
  }

  const handleTryAgain = () => {
    isRunning = false
    initNewGame()
  }

  const handleNextLevelClick = () => {
    const levelsOrder = props.lvlpicker.getLevelsOrderArray()
    levelsOrder.forEach((levelCode, index) => {
      const nextIndex = index + 1
      if (levelCode === props.lvlpicker.currentLevel) {
        if (nextIndex < levelsOrder.length) {
          props.lvlpicker.currentLevel = levelsOrder[nextIndex]
        } else {
          props.lvlpicker.currentLevel = levelsOrder[index]
        }
      }
    })
    isRunning = false
    initNewGame()
  }

  const handleResumeClick = () => {
    game!.unpause()
    props.audiohandler.playClickSound()
  }

  useEffect(() => {
    if (isRunning || !data?.me.user?.id) {
      return
    }
    initNewGame()
  }, [])

  if (loading) return <Loading />
  if (!data?.me.user?.id) {
    return <Navigate to='/login' />
  }

  return (
    <div className='game-wrapper'>
      <canvas
        ref={canvasRef}
        width='1024'
        height='576'
        key={'canvas'}
      ></canvas>
      {gamestate === GameState.Over ? (
        <GameOver
          tryAgain={handleTryAgain}
          currencyEarned={game!.currencyEarned}
          audioHandler={props.audiohandler}
        />
      ) : (
        <></>
      )}
      {gamestate === GameState.Paused ? (
        <Paused
          game={game!}
          handleResumeClick={handleResumeClick}
          audioHandler={props.audiohandler}
        />
      ) : (
        <></>
      )}
      {gamestate === GameState.Won ? (
        <GameWon
          nextLevel={handleNextLevelClick}
          currencyEarned={game!.currencyEarned}
          audioHandler={props.audiohandler}
        />
      ) : (
        <></>
      )}
    </div>
  )
}
