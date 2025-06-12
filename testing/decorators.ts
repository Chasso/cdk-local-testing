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