import api from "../../api";

/** What /api/agents/:id returns — the public fields only. */
export interface AgentProfile {
  _id: string;
  name?: string;
  companyName?: string;
  bio?: string;
  avatarUrl?: string;
  experienceYears?: number;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  createdAt?: string;
}

export const agentApi = {
  getPublicProfile: async (id: string): Promise<AgentProfile> => {
    const response = await api.get(`/agents/${id}`);
    return response.data;
  },
};

export default agentApi;
