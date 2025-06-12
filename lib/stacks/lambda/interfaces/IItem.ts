export interface INewItem {
	name: string;
	description: string;
}

export interface IItem extends INewItem {
	id: string;
	createdOn: string;
	lastModifiedOn: string;
}