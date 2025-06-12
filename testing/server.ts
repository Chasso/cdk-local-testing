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

	// Optionally, configure a service that sets up your data.
	console.group('\nExecuting Setup Scripts.');
	const setupService = new ServerSetupService();
	await setupService.setup();
	console.groupEnd();
	console.log('Setup completed.');
});
