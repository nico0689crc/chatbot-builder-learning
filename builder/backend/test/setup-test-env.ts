import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup() {
  // Carga .env.test si existe, sino cae a .env
  dotenv.config({
    path: path.resolve(__dirname, '../.env.test'),
    override: true,
  });
}
