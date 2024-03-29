import { Arg, Ctx, Mutation, Query, Resolver } from 'type-graphql'
import { ApolloContextType } from '../types/context'
import { LeaderboardResponse } from './responses/leaderboard-response'

/**
 * A resolver used for handling leaderboard events.
 */
@Resolver()
export class LeaderboardResolver {
  /**
   * Updates the leaderboard with a new time.
   *
   * @param time The total time the player survived formated as (MM:SS:MSMSMS).
   * @returns True if everything went as expected.
   */
  @Mutation(() => Boolean)
  async updateLeaderboard(
    @Arg('time', () => String) time: string,
    @Ctx() { connection, req }: ApolloContextType
  ) {
    const result = await connection.query(`
      SELECT time 
      FROM leaderboard 
      WHERE user_id = ${req.session.userId}
    `)

    const leaderboardResult = result[0] as LeaderboardResponse[]
    const leaderboard = leaderboardResult[0]

    if (!leaderboard) {
      await connection.query(`
        INSERT INTO leaderboard (id, user_id, time) 
        VALUES(${null}, ${req.session.userId}, '${time}')
      `)
    }

    if (leaderboard.time) {
      const bestTime = parseInt(leaderboard.time)

      if (parseInt(time) > bestTime) {
        await connection.query(`
          UPDATE leaderboard 
          SET time = '${time}' 
          WHERE user_id = ${req.session.userId}
        `)
      }
    }

    return true
  }

  /**
   * Fetches the leaderboard's top 50 results.
   *
   * @returns An array of the leaderboard.
   */
  @Query(() => [LeaderboardResponse])
  async leaderboard(@Ctx() { connection }: ApolloContextType): Promise<LeaderboardResponse[]> {
    const result = await connection.query(`
      SELECT username, time, experience 
      FROM leaderboard, user 
      WHERE leaderboard.user_id = user.id 
      ORDER BY time DESC 
      LIMIT 50
    `)

    const leaderboardResult = result[0] as LeaderboardResponse[]

    return leaderboardResult
  }
}
