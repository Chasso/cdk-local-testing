import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

import { v4 } from 'uuid';

const REGION = process.env.REGION!;
const TABLE_NAME = process.env.TABLE_NAME!;
const LOCAL_MODE = !!process.env.IS_LOCAL;

type RESOURCE_TYPE = 'ITEM';
type RESOURCE_FILTER = RESOURCE_TYPE | `${RESOURCE_TYPE}#${string}`;

export class DynamoDbService {
	private client: DynamoDBDocumentClient;

	constructor() {
		const dynamoDbClient = new DynamoDBClient({
			region: REGION,
			endpoint: LOCAL_MODE ? 'http://localhost:8000' : undefined
		});
		this.client = DynamoDBDocumentClient.from(dynamoDbClient);
	}

	/**
	 * Get a list of items.
	 * 
	 * @param sk - Specified type for main items, string for other items.
	 * @param pk - Additional filter for the items.
	 * @returns 
	 */
	async list<T>(sk: RESOURCE_FILTER, pk: RESOURCE_FILTER): Promise<T[]> {
		const cmd = new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'SK-PK-index',
			KeyConditionExpression: 'SK = :sk and begins_with(PK, :pk)',
			ExpressionAttributeValues: {
				':sk': sk,
				':pk': pk
			}
		});

		console.log(`Executing Query Command for 1st page.`);
		let results = await this.client.send(cmd);
		const items = [...results.Items!];

		let pageNumber = 1;
		while (results.LastEvaluatedKey) {
			console.log(`Loading page ${++pageNumber} from DynamoDB.`);
			cmd.input.ExclusiveStartKey = results.LastEvaluatedKey;

			results = await this.client.send(cmd);
			if (results.Items?.length) items.push(...results.Items);
		}

		console.log(`Returning ${items.length} items.`);
		return this.removeKeys(items);
	}

	/**
	 * Create a new item in the database.
	 * 
	 * @param resource 
	 * @param pk 
	 * @param sk 
	 * @returns 
	 */
	async create(resource: any, pk: RESOURCE_FILTER, sk: RESOURCE_FILTER) {
		resource.id = v4();
		resource.createdOn = new Date().toISOString();
		resource.PK = `${pk}#${resource.id}`;
		resource.SK = sk;

		await this.putItem(resource);

		return resource.id;
	}

	/**
	 * Create a new item in the database.
	 * 
	 * @param resource 
	 * @param pk 
	 * @param sk 
	 * @returns 
	 */
	async createLink(resource: any, pk: RESOURCE_FILTER, sk: RESOURCE_FILTER) {
		resource.createdOn = new Date().toISOString();
		resource.PK = pk;
		resource.SK = sk;

		await this.putItem(resource);
	}

	/**
	 * Get an item.
	 * 
	 * @param id 
	 * @param pk 
	 * @param sk 
	 * @returns 
	 */
	async get<T>(id: string, pk: RESOURCE_FILTER, sk: RESOURCE_FILTER): Promise<T | undefined> {
		const cmd = new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `${pk}#${id}`,
				SK: sk
			}
		});

		const response = await this.client.send(cmd);
		if (!response.Item) return undefined;

		return this.removeKeys([response.Item])[0];
	}

	/**
	 * Update an item.
	 * 
	 * @param resource 
	 * @param pk 
	 * @param sk 
	 */
	async update(resource: any, pk: RESOURCE_FILTER, sk: RESOURCE_FILTER) {
		resource.PK = `${pk}#${resource.id}`;
		resource.SK = sk;

		const existingItem: any | undefined = await this.get(resource.id, pk, sk);
		if (!existingItem) throw '404';

		for (const prop in resource) {
			if (['createdOn', 'id'].includes(prop)) continue;

			existingItem[prop] = resource[prop];
		}

		await this.putItem(existingItem);
	}

	/**
	 * Delete an item.
	 * 
	 * @param id 
	 * @param pk 
	 * @param sk 
	 */
	async delete(id: string, pk: RESOURCE_FILTER, sk: RESOURCE_FILTER) {
		const cmd = new DeleteCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `${pk}#${id}`,
				SK: sk
			}
		});

		await this.client.send(cmd);
	}

	/**
	 * Delete an item when you have both the PK & SK.
	 * 
	 * @param pk 
	 * @param sk 
	 */
	async deleteWithFullKey(pk: RESOURCE_FILTER, sk: RESOURCE_FILTER) {
		const cmd = new DeleteCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: pk,
				SK: sk
			}
		});

		await this.client.send(cmd);
	}

	/**
	 * Remove the PK & SK properties from the items.
	 * 
	 * @param items 
	 * @returns 
	 */
	private removeKeys(items: Record<string, any>[]) {
		return items.map((item: any) => {
			const { SK, PK, ...otherFields } = item;
			return otherFields;
		});
	}

	/**
	 * Save an item to DynamoDB.
	 * 
	 * @param resource 
	 */
	private async putItem(resource: any) {
		resource.lastModifiedOn = new Date().toISOString();

		const cmd = new PutCommand({
			TableName: TABLE_NAME,
			Item: resource
		});

		await this.client.send(cmd);
	}
}