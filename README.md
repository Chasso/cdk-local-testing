# CDK Local Testing

CDK Local Testing is a TypeScript-based boilerplate for building and testing AWS CDK applications locally. It supports rapid development with a lightweight Express server, environment configuration via .env, and a Docker-based DynamoDB setup using the single-table design pattern. Ideal for developers who want to validate their Lambda logic and infrastructure without deploying to the cloud every time.

![Node.js version](https://img.shields.io/badge/node-%3E=18-blue)

---

## Table of Contents

- [Overview](#cdk-local-testing)
- [Useful Commands](#useful-commands)
- [Setting Up Local DynamoDB](#setting-up-local-dynamodb)
- [Enabling Local Testing](#enabling-local-testing)
- [Starting the Local Server](#starting-the-local-server)
- [Code Examples](#code-examples)
- [License](#license)

---

## Useful Commands

- `npm run build` – Compile TypeScript to JavaScript  
- `npm run watch` – Watch for changes and compile  
- `npm run test` – Run Jest unit tests  
- `npx cdk deploy` – Deploy the stack to your AWS account/region  
- `npx cdk diff` – Compare deployed stack with current state  
- `npx cdk synth` – Generate the CloudFormation template  

---

## Setting Up Local DynamoDB

1. **Run a local DynamoDB container:**
   ```bash
   docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
   ```

2. **Start the container:**
   ```bash
   docker start dynamodb-local
   ```

3. **Stop the container:**
   ```bash
   docker stop dynamodb-local
   ```

4. **Create a table:**
   ```bash
   aws dynamodb create-table \
     --cli-input-json file://testing/dynamodb.table-config.json \
     --endpoint-url http://localhost:8000
   ```

5. **Verify the table:**
   ```bash
   aws dynamodb list-tables --endpoint-url http://localhost:8000
   ```

---

## Enabling Local Testing

Install the required dev dependencies:

```bash
npm install --save-dev express @types/express cors @types/cors reflect-metadata dotenv glob@^9
```

- `express` – Lightweight Node.js web framework  
- `@types/express` - Adds the declaration file for express.
- `cors` - Allows you to set cors details for the express server.
- `@types/cors` - Adds the declaration file for cors.
- `reflect-metadata` – Enables decorators
- `dotenv` – Loads environment variables
- `glob@^9` – Loads all controller files. The latest version (11 at the time of documenting) causes compile issues.

Create a `testing` folder and add the following files to it:

1. `.env` – Environment variables
2. `decorators.ts` – Decorators and controller registry
3. `server.ts` – Express server setup

---

## Starting the Local Server

Run the following in your console:

```bash
clear | npm run build:local | node dist/testing/server
```

Make sure your `package.json` includes:

```json
"scripts": {
  "build:local": "(if exist dist rmdir /s /q dist) && tsc",
  "build": "tsc"
}
```

---

## Successful Running Example

![Successful running screenshot](screenshots/server-running.png)

---

## Code Examples

### `.env`

```dotenv
TABLE_NAME=dev-data
REGION=eu-west-1
IS_LOCAL=true
```

---

### `decorators.ts`

```ts
import 'reflect-metadata';

type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "all";

function createRoute(route: string) {
    return function (method: HttpMethod) {
        return function (target: any, propertyKey: string) {
            Reflect.defineMetadata('method', method, target, propertyKey);
            Reflect.defineMetadata('route', route, target, propertyKey);
        };
    };
}

// Decorators for methods
export const Get = (route: string) => createRoute(route)('get');
export const Post = (route: string) => createRoute(route)('post');
export const Put = (route: string) => createRoute(route)('put');
export const Patch = (route: string) => createRoute(route)('patch');
export const Delete = (route: string) => createRoute(route)('delete');

// Decorator for classes
export const controllers: Function[] = [];
export const Controller = (basePath: string): ClassDecorator => {
    return (target) => {
        Reflect.defineMetadata('basePath', basePath, target);
        controllers.push(target);
    };
}
```

---

### `server.ts`

```ts
import 'reflect-metadata';
import cors from 'cors';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { globSync } from 'glob';

/**
 * Load environments from location other than the root folder. 
 * 
 * ? This will go out of the dist folder to find the file.
 * ! Place it above the controllers import to make sure the variables are available in the controllers.
 */
dotenv.config({
    path: path.resolve(__dirname, '..', '..', 'testing', '.env')
});

globSync('../lib/stacks/lambda/code/**/*.js', { cwd: __dirname }).forEach(f => require(path.join(__dirname, f)));

import { controllers } from './decorators';
// Optional service used to import test-data
import { ServerSetupService } from './server-setup.service';

const app = express();
app.use(express.json());
app.use(cors());

type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "all";

// Keep track of routes to test for duplicates
const routes: string[] = [];

controllers.forEach((controller: any) => {
    const instance = new (controller as any)();
    const ctor = instance.constructor as any;
    const base: string = Reflect.getMetadata('basePath', ctor) || '';
    
    const prototype = Object.getPrototypeOf(instance);
    const methodNames = Object.getOwnPropertyNames(prototype).filter(name => name !== 'constructor');

    methodNames.forEach(methodName => {
        const route: string = Reflect.getMetadata('route', prototype, methodName);
        const httpMethod: HttpMethod = Reflect.getMetadata('method', prototype, methodName)?.toLowerCase();
        const fullPath = `/${[base, route].filter(Boolean).join('/')}`;
        
        if (fullPath && httpMethod) {
            const route = `[${httpMethod.toUpperCase()}] ${fullPath}`;
            const isExistingRoute = routes.includes(route);
            
            if (isExistingRoute) {
                console.error(`Duplicate Route: ${route}`);
                throw `Duplicate Route: ${route}`;
            }
            else routes.push(route);
            
            app[httpMethod](fullPath, async (req: any, res: any) => {
                try {
                    if (req.body && typeof req.body === 'object') req.body = JSON.stringify(req.body);
                    if (req.params) req.pathParameters = req.params;
                    
                    const result = await instance[methodName](req);
                    if (typeof result.body === 'string') result.body = JSON.parse(result.body);
                    
                    res.status(result.statusCode || 200).json(result.body || {});
                } catch (e: any) {
                    res.status(500).json({ error: e.message });
                }
            });
            
            console.log(`Registered route: [${httpMethod.toUpperCase()}] ${fullPath}`);
        }
    });
});

const PORT = 3000;

app.listen(PORT, async () => {
    console.log(`Mock API server running on http://localhost:${PORT}`);
});

```

---

### `Controller`

```ts
import { Controller, Get } from "../../../../../testing/decorators";
import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { IItem } from "../../interfaces/IItem";
import { IRequest } from "../../interfaces/IRequest";
import { DynamoDbService } from "../../services/dynamodb.service";

@Controller('items')
export class ItemsGetController {
    @Get(':id')
    async handler(request: IRequest) {
        try {
            console.log('Fetching Item.');
            const dynamoDbService = new DynamoDbService();
            const item = await dynamoDbService.get<IItem>(request.pathParameters.id, 'ITEM', 'ITEM');

            console.log('Done.');
            return buildResponseBody(200, item, 'ALLOW');
        } catch (error: any) {
            console.log(`Failed to get Item with ID ${request.pathParameters.id}:`, error);
            return buildResponseBody(500, error.message, 'ALLOW');
        }
    }
}

export const handler = async (request: IRequest) => {
    const controller = new ItemsGetController();
    return await controller.handler(request);
}
```

---

### `dynamodb.table-config.json`

```json
{
    "TableName": "dev-data",
    "BillingMode": "PAY_PER_REQUEST",
    "AttributeDefinitions": [
        {
            "AttributeName": "PK",
            "AttributeType": "S"
        },
        {
            "AttributeName": "SK",
            "AttributeType": "S"
        }
    ],
    "KeySchema": [
        {
            "AttributeName": "PK",
            "KeyType": "HASH"
        },
        {
            "AttributeName": "SK",
            "KeyType": "RANGE"
        }
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "SK-PK-index",
            "KeySchema": [
                {
                    "AttributeName": "SK",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "PK",
                    "KeyType": "RANGE"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        }
    ]
}
```

---

### 🗺️ Project Diagram

````md
## Project Architecture

+-----------------------------+
|     Developer Machine       |
|                             |
|  ┌───────────────────────┐  |
|  |  Express Local Server |  |
|  |  (server.ts)          |  |
|  └───────────────────────┘  |
|           │                 |
|           ▼                 |
|  ┌───────────────────────┐  |
|  | Local DynamoDB (Docker)| |
|  └───────────────────────┘  |
+-----------------------------+

         ▲
         │
         │ CDK Deploy
         ▼

+-----------------------------+
|        AWS Cloud            |
|                             |
|  ┌───────────────────────┐  |
|  |   Lambda Function     |  |
|  |   (from lib/)         |  |
|  └───────────────────────┘  |
|           │                 |
|           ▼                 |
|  ┌───────────────────────┐  |
|  |     DynamoDB Table    |  |
|  └───────────────────────┘  |
+-----------------------------+

````

---

## License

MIT
