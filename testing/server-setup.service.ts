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

	private async listTables() {
		console.group('Getting list of existing tables.');

		const cmd = new ListTablesCommand();
		const response = await this.client.send(cmd);
		const tableNames = response.TableNames || [];

		console.log(`Found ${tableNames.length} table(s).`);
		console.groupEnd();

		return tableNames;
	}

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
			const cmd = new PutCommand({
				TableName: TABLE_NAME,
				Item: record
			});
			await this.client.send(cmd);
		}

		console.groupEnd();
		console.log(`Sourcing from CSV completed.`);
	}

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
}