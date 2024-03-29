import { Enemy } from './entities/enemy'
import { Background } from './background'
import { UpgradesHandler } from './upgrade-logic/upgrades-handler'
import { LevelPicker } from './level-picker'
import { Splitter } from './entities/enemy-types/splitter'
import { LevelOne } from './levels/level-one'
import { Character, GameState, Level, UpgradeType } from './util/enums'
import { Particle } from './entities/particle'
import { TCanvasRef } from '../types/types'
import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import {
  LeaderboardDocument,
  MeDocument,
  UpdateCurrencyDocument,
  UpdateCurrencyMutationResult,
  UpdateExperienceDocument,
  UpdateExperienceMutationResult,
  UpdateLeaderboardDocument,
  UpdateLeaderboardMutationResult,
  UpgradesDocument,
  UpgradesQueryResult
} from '../generated/graphql'
import { CharacterPicker } from './character-picker'
import { Gunner } from './entities/characters/gunner'
import { CharacterInterface } from './entities/characters/character-interface'
import { Beamer } from './entities/characters/beamer'
import { LevelEndless } from './levels/level-endless'
import { Timer } from './timer'
import { ImageHandler } from '../misc/image-handler'
import { CurrencyDisplay } from './currency-display'
import { TStateChangeCb } from '../types/types'
import { AudioHandler } from '@/misc/audio-handler'

export class Game {
  #canvasRef
  #player!: CharacterInterface
  #enemies: Enemy[]
  #background: Background
  #upgrades: UpgradesHandler
  #levelPicker: LevelPicker
  #currencyEarned: number
  #gamestate: GameState
  #particles: Particle[]
  #isExploding
  #apolloClient
  #characterPicker
  #xpEarned
  #timer
  #imageHandler
  #previousFrameTime
  #currentFrameTime
  #fps
  #frameInterval
  #currencyDisplay
  #stateChangeCb
  #audioHandler

  constructor(
    lvlPicker: LevelPicker,
    canvasRef: TCanvasRef,
    characterPicker: CharacterPicker,
    client: ApolloClient<NormalizedCacheObject>,
    stateChangeCb: TStateChangeCb,
    audioHandler: AudioHandler
  ) {
    this.#canvasRef = canvasRef
    this.#apolloClient = client
    this.#enemies = []
    this.#background = new Background()
    this.#upgrades = new UpgradesHandler(client)
    this.#levelPicker = lvlPicker
    this.#currencyEarned = 0
    this.#gamestate = GameState.Playing
    this.#particles = []
    this.#isExploding = false
    this.#characterPicker = characterPicker
    this.#xpEarned = 0
    this.#timer = new Timer({ canvasRef })
    this.#imageHandler = new ImageHandler()
    this.#currencyDisplay = new CurrencyDisplay({ canvasRef })
    this.#previousFrameTime = Date.now()
    this.#currentFrameTime = Date.now()
    this.#fps = 60
    this.#frameInterval = 1000 / this.#fps
    this.#stateChangeCb = stateChangeCb
    this.#audioHandler = audioHandler
  }

  get gamestate() {
    return this.#gamestate
  }

  get currencyEarned() {
    return this.#currencyEarned
  }

  get canvasRef() {
    return this.#canvasRef
  }

  set gamestate(gameState: GameState) {
    this.#gamestate = gameState
  }

  addEnemyToArray(enemy: Enemy) {
    this.#enemies.push(enemy)
  }

  /**
   * Adds necessary listeners for controlling the character and controlling the game's pause state.
   */
  #addCharacterListeners() {
    this.#canvasRef.canvas!.addEventListener('mousemove', (e) => {
      this.#player.position.x = e.offsetX
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.#gamestate === GameState.Paused) {
          this.unpause()
        } else {
          this.#pause()
        }
      } else if (e.key === ' ') {
        this.#player.useAbility()
      }
    })
    window.addEventListener('blur', (e) => {
      this.#pause()
    })
  }

  /**
   * Pauses the game.
   */
  #pause() {
    if (this.#gamestate === GameState.Won || this.#gamestate === GameState.Over) {
      return
    }
    this.#gamestate = GameState.Paused
    this.#stateChangeCb(this.#gamestate)
    this.#timer.startPausedTime()
  }

  /**
   * Unpauses the game.
   */
  unpause() {
    this.#gamestate = GameState.Playing
    this.#stateChangeCb(this.#gamestate)
    this.#timer.subtractPausedTime()
    this.#loop()
  }

  /**
   * Loads the gunner and sets the player to the gunner character.
   */
  async #loadGunner() {
    const gunnerImg = await this.#imageHandler.getImage('/img/spaceship.png')
    const projImg = await this.#imageHandler.getImage('/img/bullet.png')

    this.#player = new Gunner({
      position: {
        x: this.#canvasRef.canvas.width / 2 - 25,
        y: this.#canvasRef.canvas.height * 0.87
      },
      velocity: {
        x: 0,
        y: 0
      },
      size: {
        width: 50,
        height: 50
      },
      canvasRef: this.#canvasRef,
      images: {
        playerImage: gunnerImg,
        projImage: projImg
      },
      properties: {
        attackRate: 200,
        numberOfProjectiles: 7,
        pierceAmount: 0,
        damage: 6650
      },
      enemies: this.#enemies,
      audioHandler: this.#audioHandler
    })

    await this.#applyGunnerUpgrades()

    const shootInterval = setInterval(() => {
      if (this.#gamestate === GameState.Playing) {
        this.#player.shoot()
      } else if (this.#gamestate === GameState.Over || this.#gamestate === GameState.Won) {
        clearInterval(shootInterval)
      }
    }, this.#player.properties.attackRate)
  }

  /**
   * Loads the beamer and sets the player to the beamer character.
   */
  async #loadBeamer() {
    const beamerImg = await this.#imageHandler.getImage('/img/beamer.png')
    const beamImg = await this.#imageHandler.getImage('/img/beam.png')
    const beamStartImg = await this.#imageHandler.getImage('/img/beamstart.png')

    this.#player = new Beamer({
      position: {
        x: this.#canvasRef.canvas.width / 2 - 25,
        y: this.#canvasRef.canvas.height * 0.87
      },
      velocity: {
        x: 0,
        y: 0
      },
      size: {
        width: 50,
        height: 50
      },
      canvasRef: this.#canvasRef,
      images: {
        beamerImg,
        beamImg,
        beamStartImg
      },
      properties: {
        attackRate: 1,
        numberOfProjectiles: 0,
        pierceAmount: 0,
        damage: 1000
      },
      enemies: this.#enemies
    })

    await this.#applyBeamerUpgrades()
    this.#player.shoot()
  }

  /**
   * Creates the background.
   */
  #createBackground() {
    this.#background.initzializeBackground(this.#canvasRef)

    const starInterval = 2000

    setInterval(() => {
      if (this.#gamestate === GameState.Paused) {
        return
      }
      this.#background.addStar(this.#canvasRef, -5)
    }, starInterval)
  }

  /**
   * Applies upgrades for the gunner character.
   */
  async #applyGunnerUpgrades() {
    const result = (await this.#apolloClient.query({
      query: UpgradesDocument,
      variables: {
        characterId: Character.Gunner
      }
    })) as UpgradesQueryResult

    if (!result.data?.upgrades) {
      return
    }

    for (const dbUpgrade of result.data.upgrades) {
      for (const defaultUpgrade of this.#upgrades.upgrades) {
        if (dbUpgrade.upgrade_id === defaultUpgrade.id) {
          switch (defaultUpgrade.id) {
            case UpgradeType.AddProjectile:
              this.#player.properties.numberOfProjectiles += 1
              break
            case UpgradeType.DuplicateProjectiles:
              this.#player.properties.numberOfProjectiles *= 2
              break
            case UpgradeType.AddPierce:
              this.#player.properties.pierceAmount += 1
              break
            case UpgradeType.AddDamageTen:
              this.#player.properties.damage *= 1.1
              break
            case UpgradeType.AddDamageTwenty:
              this.#player.properties.damage *= 1.2
              break
            case UpgradeType.AddDamageThirty:
              this.#player.properties.damage *= 1.3
              break
            case UpgradeType.AddAttackRateTen:
              this.#player.properties.attackRate /= 1.1
              break
            case UpgradeType.AddAttackRateTwenty:
              this.#player.properties.attackRate /= 1.2
              break
            case UpgradeType.AddAttackRateThirty:
              this.#player.properties.attackRate /= 1.3
              break
          }
        }
      }
    }
  }

  /**
   * Applies upgrades for the beamer character
   */
  async #applyBeamerUpgrades() {
    const result = (await this.#apolloClient.query({
      query: UpgradesDocument,
      variables: {
        characterId: Character.Beamer
      }
    })) as UpgradesQueryResult

    if (!result.data?.upgrades) {
      return
    }

    for (const dbUpgrade of result.data.upgrades) {
      for (const defaultUpgrade of this.#upgrades.upgrades) {
        if (dbUpgrade.upgrade_id === defaultUpgrade.id) {
          switch (defaultUpgrade.id) {
            case UpgradeType.AddDamageTen:
              this.#player.properties.damage *= 1.1
              break
            case UpgradeType.AddDamageTwenty:
              this.#player.properties.damage *= 1.2
              break
            case UpgradeType.AddDamageThirty:
              this.#player.properties.damage *= 1.3
              break
            case UpgradeType.AddAttackRateTen:
              this.#player.properties.attackRate /= 1.1
              break
            case UpgradeType.AddAttackRateTwenty:
              this.#player.properties.attackRate /= 1.2
              break
            case UpgradeType.AddAttackRateThirty:
              this.#player.properties.attackRate /= 1.3
              break
          }
        }
      }
    }
  }

  /**
   * Initizalises the picked level.
   */
  #initLevel() {
    if (this.#levelPicker.currentLevel === Level.Endless) {
      const levelEndless = new LevelEndless(this, 1, this.#imageHandler)
      levelEndless.play()
    } else if (this.#levelPicker.currentLevel === Level.One) {
      const levelOne = new LevelOne(this, 1)
      levelOne.play()
    }
  }

  /**
   * Clears the canvas.
   */
  #clearCanvas() {
    this.#canvasRef.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    this.#canvasRef.ctx.fillRect(0, 0, this.#canvasRef.canvas.width, this.#canvasRef.canvas.height)
  }

  /**
   * Updates the stars in the background.
   */
  #updateBackground() {
    this.#background.stars.forEach((star, index, object) => {
      if (star.isActive) {
        star.update()
      } else {
        object.splice(index, 1)
      }
    })
  }

  /**
   * Adds a certain amount of particles with slow velocity to the game.
   *
   * @param x The starting X-position of the particle.
   * @param y The starting Y-position of the particle.
   * @param numberOfParticles The amount of particles to be added.
   */
  #createParticles(x: number, y: number, numberOfParticles: number) {
    const size = 5
    const width = size
    const height = size

    for (let i = 0; i < numberOfParticles; i++) {
      this.#particles.push(
        new Particle({
          position: {
            x,
            y
          },
          velocity: {
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() - 0.5) * 2
          },
          size: {
            width,
            height
          },
          canvasRef: this.#canvasRef
        })
      )
    }
  }

  /**
   * Adds a certain amount of particles with fast velocity to the game.
   *
   * @param x The starting X-position of the particle.
   * @param y The starting Y-position of the particle.
   * @param numberOfParticles The amount of particles to be added.
   */
  #createParticlesExplosion(x: number, y: number, numberOfParticles: number) {
    const size = 5
    const width = size
    const height = size

    for (let i = 0; i < numberOfParticles; i++) {
      this.#particles.push(
        new Particle({
          position: {
            x,
            y
          },
          velocity: {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 6
          },
          size: {
            width,
            height
          },
          canvasRef: this.#canvasRef,
          friction: 0.996
        })
      )
    }
  }

  /**
   * Does every general action when an enemy dies.
   *
   * @param enemy The enemy that was killed.
   */
  #enemyKilled(enemy: Enemy) {
    this.#audioHandler.playKillSound()
    if (enemy.isWinCondition) {
      this.#gamestate = GameState.Won
    }
    this.#currencyEarned += enemy.currency
    this.#xpEarned += enemy.xp
    this.#createParticles(enemy.position.x, enemy.position.y, 10)
  }

  /**
   * Updates every enemy within the game.
   */
  #updateEnemies() {
    this.#enemies.forEach((enemy, index, object) => {
      if (enemy.hitpoints.current > 0) {
        if (enemy.reachedEnd) {
          this.#gamestate = GameState.Over
          return
        } else {
          enemy.update()
        }
      } else if (enemy instanceof Splitter) {
        enemy.update()
        this.#enemyKilled(enemy)
        object.splice(index, 1)
      } else {
        this.#enemyKilled(enemy)
        object.splice(index, 1)
      }
      if (enemy.flash) {
        if (enemy.flash.alpha > 0) {
          enemy.flash.update()
        }
      }
    })
  }

  /**
   * Updates all particles within the game.
   */
  #updateParticles() {
    this.#particles.forEach((particle, index, object) => {
      if (particle.alpha > 0) {
        particle.update()
      } else {
        object.splice(index, 1)
      }
    })
  }

  /**
   * Updates the players currency within the database.
   */
  async #updatePlayerCurrency() {
    ;(await this.#apolloClient.mutate({
      mutation: UpdateCurrencyDocument,
      variables: {
        currency: this.#currencyEarned
      },
      refetchQueries: [{ query: MeDocument }]
    })) as UpdateCurrencyMutationResult
  }

  /**
   * Updates the players xp within the database.
   */
  async #updatePlayerXp() {
    ;(await this.#apolloClient.mutate({
      mutation: UpdateExperienceDocument,
      variables: {
        experience: this.#xpEarned
      },
      refetchQueries: [{ query: MeDocument }]
    })) as UpdateExperienceMutationResult
  }

  /**
   * Initializes the players chosen character.
   */
  async #initCharacter() {
    if (this.#characterPicker.chosenCharacter === Character.Gunner) {
      await this.#loadGunner()
    } else if (this.#characterPicker.chosenCharacter === Character.Beamer) {
      await this.#loadBeamer()
    } else if (this.#characterPicker.chosenCharacter === Character.Three) {
    }
  }

  /**
   * Updates the leaderboard in the database.
   */
  async #updateLeaderboard() {
    ;(await this.#apolloClient.mutate({
      mutation: UpdateLeaderboardDocument,
      variables: {
        time: this.#timer.endTime
      },
      refetchQueries: [{ query: LeaderboardDocument }]
    })) as UpdateLeaderboardMutationResult
  }

  /**
   * Ends the game.
   */
  #endGame() {
    this.#stateChangeCb(this.#gamestate)
    this.#updatePlayerCurrency()
    this.#updatePlayerXp()
    if (this.#levelPicker.currentLevel === Level.Endless) {
      this.#updateLeaderboard()
    }
  }

  /**
   * Starts the game.
   */
  async play() {
    this.#createBackground()
    await this.#initCharacter()
    this.#addCharacterListeners()
    this.#initLevel()
    this.#loop()
  }

  /**
   * Constantly updates everything within the game.
   */
  #loop() {
    if (this.#gamestate === GameState.Over) {
      this.#endGame()
      return
    } else if (this.#gamestate === GameState.Paused) {
      return
    } else if (this.#gamestate === GameState.Won && this.#particles.length === 0) {
      this.#endGame()
      return
    }

    window.requestAnimationFrame(() => this.#loop())

    this.#currentFrameTime = Date.now()
    const timeDiffernce = this.#currentFrameTime - this.#previousFrameTime

    if (timeDiffernce <= this.#frameInterval) {
      return
    }

    this.#previousFrameTime = this.#currentFrameTime - (timeDiffernce % this.#frameInterval)
    this.#clearCanvas()
    this.#updateBackground()
    this.#updateParticles()
    this.#player.update()
    if (this.#gamestate === GameState.Won) {
      if (this.#isExploding) {
        return
      } else {
        this.#createParticlesExplosion(
          this.#canvasRef.canvas.width / 2,
          this.#canvasRef.canvas.height / 2,
          350
        )
        this.#isExploding = true
        return
      }
    }
    this.#updateEnemies()
    this.#timer.update()
    this.#currencyDisplay.update(this.#currencyEarned)
  }
}
