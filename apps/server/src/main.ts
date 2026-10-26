import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  const origins = (
    config.get<string>("CLIENT_ORIGIN") ?? "http://localhost:8082"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  app.enableShutdownHooks();
  await app.listen(
    Number(config.get<string>("PORT") ?? 3000),
    config.get<string>("HOST") ?? "127.0.0.1",
  );
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
