import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAllowed, setAllowed, getUserInfo } from '@stellar/freighter-api';
import { Client as Registry, networks } from '@milepost/registry';
import { Client as Programme } from '@milepost/program';

// Testnet Config
const RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const PROGRAMME_ID = 'CD236SGR4CHW3N5WA5REW7CDLCS4ZLDEX6JVEAIHZK7NSN4W7WD7YDAL';

// Formatting Helper (i128 stroops to XLM string)
const toXLM = (stroops: bigint | undefined | null) => {
  if (stroops === undefined || stroops === null) return '0.00';
  return (Number(stroops) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Initialize Clients
const registryClient = new Registry({ ...networks.testnet, rpcUrl: RPC_URL });
const programmeClient = new Programme({
  contractId: PROGRAMME_ID,
  networkPassphrase: networks.testnet.networkPassphrase,
  rpcUrl: RPC_URL,
});

interface SorobanContextType {
  address: string | null;
  connectWallet: () => Promise<void>;
  registry: typeof registryClient;
  programme: typeof programmeClient;
  formatAmount: typeof toXLM;
}

const SorobanContext = createContext<SorobanContextType | undefined>(undefined);

export const SorobanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);

  // Check connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (await isAllowed()) {
          const userInfo = await getUserInfo();
          if (userInfo.publicKey) {
            setAddress(userInfo.publicKey);
          }
        }
      } catch (error) {
        console.error('Failed to connect to Freighter', error);
      }
    };
    checkConnection();
  }, []);

  const connectWallet = async () => {
    try {
      await setAllowed();
      const userInfo = await getUserInfo();
      if (userInfo.publicKey) {
        setAddress(userInfo.publicKey);
      }
    } catch (error) {
      console.error('Wallet connection failed', error);
    }
  };

  return (
    <SorobanContext.Provider value={{ address, connectWallet, registry: registryClient, programme: programmeClient, formatAmount: toXLM }}>
      {children}
    </SorobanContext.Provider>
  );
};

const useSoroban = () => {
  const context = useContext(SorobanContext);
  if (context === undefined) {
    throw new Error('useSoroban must be used within a SorobanProvider');
  }
  return context;
};

export { useSoroban };
