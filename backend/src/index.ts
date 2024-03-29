import express from 'express'
import dotenv from 'dotenv'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core'
import { UserResolver } from './resolvers/user-resolver'
import { buildSchema } from 'type-graphql'
import 'reflect-metadata'
import cors from 'cors'
import session from 'express-session'
import { UpgradesResolver } from './resolvers/upgrades-resolver'
import { LeaderboardResolver } from './resolvers/leaderboard-resolver'
import MySQLStore from 'express-mysql-session'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MySQLSessionStore = require('express-mysql-session')(session)
import * as mysql from 'mysql2/promise'
import http from 'http'

/**
 * Main function for starting the server.
 */
const main = async () => {  
  dotenv.config()
  const app = express()
  const httpServer = http.createServer(app)
  const PORT = process.env.PORT || 3001
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
  const connection = await mysql.createConnection(process.env.DATABASE_URL!)

  setInterval(() => {
    connection.ping()
  }, 1000 * 60 * 10)

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
    app.use(cors({
      origin: [FRONTEND_URL],
      credentials: true,
    }))
  }

  app.use(
    session({
      name: 'auth',
      secret: process.env.SESSION_SECRET!,
      store: new MySQLSessionStore(
        {
          createDatabaseTable: true,
          clearExpired: true,
        } as MySQLStore.Options,
        connection
      ),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: process.env.NODE_ENV === 'production' ? false : true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production' ? true : false,
      },
      resave: false,
      saveUninitialized: false,
    })
  )

  const server = new ApolloServer({
    schema: await buildSchema({
      resolvers: [UserResolver, UpgradesResolver, LeaderboardResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      connection,
      req,
      res,
    }),
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    persistedQueries: false
  })

  const corsOptions: cors.CorsOptions = {
    origin: [FRONTEND_URL]
  }

  await server.start()
  server.applyMiddleware({ app, cors: corsOptions })

  app.listen(PORT, () => console.log(`Listening on port: ${PORT}`))
}

try {
  main()
} catch (e) {
  console.error(e)
}
