export {
  createClient,
  deleteClient,
  getClientById,
  getClientUsers,
  listClients,
  permanentlyDeleteClient,
  restoreClient,
  updateClient,
} from '../modules/clients/application/client.service.js';

export type {
  PaginationParams,
  PaginatedResult,
} from '../modules/clients/application/client.service.interfaces.js';
