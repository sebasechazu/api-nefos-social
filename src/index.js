'use strict';

import { MongoClient, ServerApiVersion } from 'mongodb';
import { config } from 'dotenv';
import app from './app.js';
import open from 'open';
import net from 'net';

console.clear();

config();

const username = process.env.APP_USERNAME;
const password = process.env.PASSWORD;
const dbName = process.env.DB_NAME;
const port = process.env.PORT;

const uri = `mongodb+srv://${username}:${password}@cluster0.6gwvgg8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let server;  // Referencia al servidor de Express

export async function connectDatabase() {
  try {
    await client.connect();
    console.log('Conexión exitosa a la base de datos');
    app.locals.db = client.db(dbName);
    console.log('Base de datos conectada:', dbName);
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
  }
}

export function getApp() {
  return app;
}

export function getDatabase() {
  if (!app.locals.db) {
    throw new Error('La base de datos no está conectada. Asegúrate de llamar a connectDatabase antes de usar getDatabase.');
  }
  return app.locals.db;
}

export async function startServer() {
  try {
    await connectDatabase();


    server = app.listen(port, async () => {
      console.log(`Servidor corriendo en el puerto ${port}`);

      const client = new net.Socket();

      client.once('connect', () => {
        client.end();
      });

      client.once('error', async (err) => {
        if (err.code === 'ECONNREFUSED') {
          await open(`http://localhost:${port}/status`);
        }
      });

      client.connect({ port });
    });

  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
}

process.on('SIGINT', async () => {
  console.log('Cerrando la conexión a la base de datos');
  await client.close();

  if (server) {
    server.close(() => {
      console.log('Servidor cerrado correctamente');
      process.exit(0);
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

startServer();
