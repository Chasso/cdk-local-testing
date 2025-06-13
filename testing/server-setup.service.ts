import { CreateTableCommand, DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const REGION = process.env.REGION!;
const TABLE_NAME = process.env.TABLE_NAME!;

interface CsvRow {
	[key: string]: string;
}

/**
 * This service is used to help finish the startup process of your local express server.
 */
export class ServerSetupService {
	private client: DynamoDBDocumentClient;

	constructor() {
		const dynamoDbClient = new DynamoDBClient({
			region: REGION,
			endpoint: 'http://localhost:8000'
		});
		this.client = DynamoDBDocumentClient.from(dynamoDbClient);
	}

	/**
	 * Start the setup process for the local server.
	 */
	async setup() {
		const tableNames = await this.listTables();

		console.group('Verifying that required tables exist.');

		if (!tableNames.includes(TABLE_NAME)) {
			await this.createTable();
			await this.sourceTableFromCsv();
			await this.sourceTableFromJson();
		} else console.log(`Table, ${TABLE_NAME}, already exists on the server.`);

		console.groupEnd();
	}

	/**
	 * Get a list of the DynamoDB tables on the server.
	 * 
	 * @returns 
	 */
	private async listTables() {
		console.group('Getting list of existing tables.');

		const cmd = new ListTablesCommand();
		const response = await this.client.send(cmd);
		const tableNames = response.TableNames || [];

		console.log(`Found ${tableNames.length} table(s).`);
		console.groupEnd();

		return tableNames;
	}

	/**
	 * Create a new DynamoDB table.
	 */
	private async createTable() {
		console.group(`Creating DynamoDB table: ${TABLE_NAME}.`);

		const cmd = new CreateTableCommand({
			TableName: TABLE_NAME,
			BillingMode: 'PAY_PER_REQUEST',
			KeySchema: [
				{
					AttributeName: 'PK',
					KeyType: 'HASH'
				},
				{
					AttributeName: 'SK',
					KeyType: 'RANGE'
				}
			],
			AttributeDefinitions: [
				{
					AttributeName: 'PK',
					AttributeType: 'S'
				},
				{
					AttributeName: 'SK',
					AttributeType: 'S'
				}
			],
			GlobalSecondaryIndexes: [
				{
					IndexName: 'SK-PK-index',
					KeySchema: [
						{
							AttributeName: 'SK',
							KeyType: 'HASH'
						},
						{
							AttributeName: 'PK',
							KeyType: 'RANGE'
						}
					],
					Projection: {
						ProjectionType: 'ALL'
					}
				}
			]
		});

		await this.client.send(cmd);

		console.log('Table created.');
		console.groupEnd();
	}

	/**
	 * Read a CSV file, parse the data and save it to DynamoDB.
	 */
	private async sourceTableFromCsv() {
		console.group(`Sourcing DynamoDB table ${TABLE_NAME} from CSV.`);

		const filePath = path.resolve(__dirname, '..', '..', 'testing', 'import-data.csv');
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const records: CsvRow[] = parse(fileContent, {
			columns: true,
			trim: true,
			skip_empty_lines: true,
		});

		console.log(`Sourcing ${records.length} items...`);

		for (const record of records) {
			// Remove unwanted properties caused by the CSV format
			for (const key in record)
				if (!record[key].length || record[key] === 'null')
					delete record[key];

			const cmd = new PutCommand({
				TableName: TABLE_NAME,
				Item: this.parseJsonPropertiesForCsvData(record)
			});
			await this.client.send(cmd);
		}

		console.groupEnd();
		console.log(`Sourcing from CSV completed.`);
	}

	/**
	 * Read a JSON file, parse the data and save it to DynamoDB.
	 */
	private async sourceTableFromJson() {
		console.group(`Sourcing DynamoDB table ${TABLE_NAME} from JSON.`);

		const filePath = path.resolve(__dirname, '..', '..', 'testing', 'import-data.json');
		const records: CsvRow[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

		console.log(`Sourcing ${records.length} items...`);

		for (const record of records) {
			const cmd = new PutCommand({
				TableName: TABLE_NAME,
				Item: record
			});
			await this.client.send(cmd);
		}

		console.groupEnd();
		console.log(`Sourcing from JSON completed.`);
	}

	/**
	 * The CSV data that was exported generally has stringified child objects that still include their DynamoDB types.
	 * E.g. a stringified version of [{S: "John"}, {S: "Jane"}] which ideally should be ["John", "Jane"].
	 * 
	 * This function goes through properties and tries to at least convert the properties back to objects.
	 * It then calls another function to try and fix the objects.
	 * 
	 * ! This function is currently limited to a single-level. So an object in an object will not be covered.
	 * 
	 * @see removeDynamoDbProperties
	 * 
	 * @param record 
	 * @returns 
	 */
	private parseJsonPropertiesForCsvData(record: CsvRow) {
		const output: any = {};

		for (const prop in record) {
			try {
				// Try to parse the property as JSON.
				output[prop] = JSON.parse(record[prop]);

				// Numbers not starting with a "0" would still be parsed, e,g, '123456789' would end up as 123456789, and we only want the next function to execute for objects.
				if (typeof output[prop] === 'object')
					output[prop] = this.removeDynamoDbProperties(output[prop]);
			} catch (error) {
				// If it could not be parsed, then use as is.
				output[prop] = record[prop];
			}
		}

		return output;
	}

	/**
	 * Remove the DynamoDB object properties from the property.
	 * 
	 * E.g. From:
	 * [{S: "John"}]
	 * 
	 * To:
	 * ["John"]
	 * 
	 * @param recordProp 
	 */
	private removeDynamoDbProperties(recordProp: any | any[]) {
		if (Array.isArray(recordProp)) {
			/**
			 * Detect if this is a straight array or an object array item.
			 * 
			 * A straight-array would be something like:
			 * [{S: "John"}, {S: "Jane"}]
			 * 
			 * An object array would be something like:
			 * [{firstName: {S: "John"}}, {firstName: {S: "Jane"}}]
			 */
			const isObjectArray = !Object.keys(recordProp[0]).some(key => ['S', 'N', 'BOOL'].includes(key));

			return recordProp.map(a => {
				if (isObjectArray) {
					return this.parseDynamoDbProp(a);
				}
				else {
					for (const key in a) {
						if (key === 'S') return a.S;
						else if (key === 'N') return parseFloat(a.N);
						else if (key === 'BOOL') return a.BOOL;
					}
				}
			});
		} else {
			return this.parseDynamoDbProp(recordProp);
		}
	}

	/**
	 * Parse a single property from the import data. 
	 * 
	 * ! This function can be updated to use recursion in case you need to go deeper than 1 level.
	 * 
	 * @param recordProp 
	 * @returns 
	 */
	private parseDynamoDbProp(recordProp: any) {
		const result: any = {};
		for (const key in recordProp) {
			const prop: any = recordProp[key];
			if (prop.S) result[key] = prop.S;
			else if (prop.N) result[key] = parseFloat(prop.N);
			else if (prop.BOOL) result[key] = prop.BOOL;
		}
		return result;
	}
}