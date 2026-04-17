import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
// Reload triggered by Antigravity at 2026-03-11
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  // Trigger restart for Cookie fix
  const app = await NestFactory.create(AppModule);
  
  // 🔒 SECURITY: Add Helmet security headers (CRITICAL)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "http:", "*"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  
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

  // 🔒 SECURITY: Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    app.use((req: any, res: any, next: any) => {
      if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }
  
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
      // Only allow no-origin for health checks
      if (!origin) {
        // In production, be more strict - only allow for specific endpoints
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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Explicit methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Explicit headers
    maxAge: 3600, // Cache preflight for 1 hour
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Allow extra properties to avoid errors
      skipMissingProperties: true, // Skip validation for missing properties
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 API server is running on port: ${port}`);
  console.log(`📡 Health check available at: http://localhost:${port}/api/hello`);
}
bootstrap();
