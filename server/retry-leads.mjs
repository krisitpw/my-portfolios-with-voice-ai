import {existsSync} from 'node:fs';
import {createLeadService} from './lead-service.mjs';
if(existsSync('.env'))process.loadEnvFile('.env');
await createLeadService().retry({force:true});
console.log('Stored leads checked. Delivery status is retained in the private lead records.');
