import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
// Reload triggered by Antigravity at 2026-03-11
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * 🚀 PERF / 🔒 SECURITY: trust the reverse proxy.
   *
   * Nginx terminates TLS and proxies to this process on localhost, so without
   * this every request looked like it came from 127.0.0.1. The global
   * ThrottlerGuard keys its buckets on `req.ip`, which meant the whole site —
   * every visitor, every dashboard page — shared ONE 10-requests-per-second
   * budget and started returning 429s under trivial load. Trusting the proxy
   * restores per-client IPs, so the limits apply per user as intended.
   *
   * `loopback` only: we trust X-Forwarded-For when the immediate peer is the
   * local Nginx, and never when a request arrives directly from the internet
   * (which would let anyone spoof their way past the rate limiter).
   */
  app.set('trust proxy', 'loopback');

  /**
   * 🚀 PERF: gzip/deflate responses.
   *
   * The dashboard list endpoints return large JSON arrays — property records
   * carry descriptions and photo-URL arrays — and none of it was compressed.
   * JSON of this shape typically shrinks by 80-90%, which is the single
   * cheapest win available on the admin panel's perceived load time.
   */
  app.use(
    compression({
      // Below ~1KB the header overhead outweighs the saving.
      threshold: 1024,
    }),
  );

  // 🔒 SECURITY: Add Helmet security headers (CRITICAL)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:', '*'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());

  // Increase body limit for large file uploads
  const { json, urlencoded } = require('express');
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Increase timeout for slow requests
  app.use((req: any, res: any, next: any) => {
    req.setTimeout(30000); // 30 seconds
    res.setTimeout(30000); // 30 seconds
    next();
  });

  // NOTE: HTTPS redirect removed — Nginx handles HTTPS, NestJS runs on HTTP internally

  // Serve static files for local storage - handled by ServeStaticModule in AppModule
  console.log(`🚀 API starting Middleware initialized...`);

  const allowedOrigins = [
    process.env.APP_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3005',
    'http://localhost:3010',
    'http://localhost:3011',
    'https://propertydealer.pk',
    'http://propertydealer.pk',
    'https://www.propertydealer.pk',
    'http://www.propertydealer.pk',
    'https://pro.adca.pk',
    'http://pro.adca.pk',
  ];

  // Add Vercel deployment URL for production
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Add other production domains if specified
  if (
    process.env.FRONTEND_URL &&
    !allowedOrigins.includes(process.env.FRONTEND_URL)
  ) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  console.log('✅ Allowed Origins:', allowedOrigins);

  // 🔒 SECURITY: Improved CORS configuration (CRITICAL)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Request with no origin in production');
        }
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    maxAge: 3600,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API server is running on port: ${port}`);
  console.log(
    `📡 Health check available at: http://localhost:${port}/api/hello`,
  );
}
bootstrap();
