import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true, // TODO: restringir por dominio cuando vayamos a producción
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT);
  console.log(`Application is running on: http://localhost:${PORT}`);
}
void bootstrap();
