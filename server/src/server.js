import 'dotenv/config'
import app from './app.js'

const port = Number(process.env.PORT) || 3001

app.listen(port, (error) => {
  if (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
  console.log(`API listening on http://localhost:${port}`)
})
