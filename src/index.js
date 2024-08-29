// Suggested code may be subject to a license. Learn more: ~LicenseLog:2635554352.
import { applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore(app);

export async function connectDatabase() {
  try {
    console.log('Conexión exitosa a la base de datos');
    app.locals.db = db;
    console.log('Base de datos conectada:', dbName);
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    throw error; 
  }
}
