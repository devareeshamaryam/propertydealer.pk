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
  /** On a plan with the verified badge (or an agent of such an agency). */
  verified?: boolean;
  /** Present when the plan includes social links. */
  socialLinks?: { facebook?: string; instagram?: string; youtube?: string; tiktok?: string; linkedin?: string; website?: string };
  /** Present when the plan includes a branded profile. */
  coverUrl?: string;
  /** For an agency's agent: the agency. */
  agency?: { _id: string; name: string; avatarUrl?: string } | null;
  /** For an agency: its agents. */
  team?: { _id: string; name: string; avatarUrl?: string; listings?: number }[];
}

export const agentApi = {
  getPublicProfile: async (id: string): Promise<AgentProfile> => {
    const response = await api.get(`/agents/${id}`);
    return response.data;
  },
};

export default agentApi;
