import 'reflect-metadata';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function createRoute(route: string) {
	return function (method: HttpMethod) {
		return function (target: any, propertyKey: string) {
			Reflect.defineMetadata('method', method, target, propertyKey);
			Reflect.defineMetadata('route', route, target, propertyKey);
		};
	};
}

// Factory-based decorator creators:
export const Get = (route: string) => createRoute(route)('GET');
export const Post = (route: string) => createRoute(route)('POST');
export const Put = (route: string) => createRoute(route)('PUT');
export const Patch = (route: string) => createRoute(route)('PATCH');
export const Delete = (route: string) => createRoute(route)('DELETE');

// Decorator for classes
export const controllers: Function[] = [];
export const Controller = (basePath: string): ClassDecorator => {
	return (target) => {
		Reflect.defineMetadata('basePath', basePath, target);
		controllers.push(target);
	};
}