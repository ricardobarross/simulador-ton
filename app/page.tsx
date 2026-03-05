"use client";
import { useState, useEffect } from 'react';

type PlanoNome = 'Ton Brother' | 'Gigaton' | 'Megaton';

const TAXAS_PLANOS: Record<PlanoNome, { debito: number; credito: number; parcelado12x: number }> = {
  'Ton Brother': { debito: 0.0099, credito: 0.0099, parcelado12x: 0.1299 },
  'Gigaton': { debito: 0.0179, credito: 0.0369, parcelado12x: 0.1599 },
  'Megaton': { debito: 0.0169, credito: 0.0349, parcelado12x: 0.1799 },
};

export default function SimuladorTon() {
  const [valor, setValor] = useState('1000');
  const [plano, setPlano] = useState<PlanoNome>('Megaton');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const valorNum = parseFloat(valor) || 0;
  const taxas = TAXAS_PLANOS[plano];

  const calcular = (taxa: number) => (valorNum * (1 - taxa)).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center p-6 font-sans">
      <h1 className="text-[#00FF5F] text-5xl font-black mb-10 italic tracking-tighter">TON</h1>

      <div className="bg-[#181818] w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-white/5">
        <label className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black">Valor da Venda</label>
        <div className="flex items-baseline gap-1 mt-2 mb-8 border-b border-white/10 pb-4">
          <span className="text-[#00FF5F] text-2xl font-bold">R$</span>
          <input 
            type="number" 
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="bg-transparent text-6xl font-bold text-[#00FF5F] outline-none w-full"
          />
        </div>

        <label className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black block mb-3">Seu Plano Atual</label>
        <select 
          value={plano}
          onChange={(e) => setPlano(e.target.value as PlanoNome)}
          className="w-full bg-[#252525] p-5 rounded-2xl text-white outline-none mb-10 appearance-none border border-white/5 text-lg font-medium"
        >
          <option value="Ton Brother">Ton Brother</option>
          <option value="Gigaton">Gigaton</option>
          <option value="Megaton">Megaton</option>
        </select>

        <div className="space-y-4">
          {[
            { label: 'Débito', sub: 'Receba em 1 dia', taxa: taxas.debito },
            { label: 'Crédito à Vista', sub: 'Receba em 1 dia', taxa: taxas.credito },
            { label: 'Parcelado (12x)', sub: 'Receba tudo em 1 dia', taxa: taxas.parcelado12x }
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center p-5 bg-[#202020] rounded-3xl border-l-[6px] border-[#00FF5F]">
              <div>
                <p className="text-gray-500 text-[10px] uppercase font-black">{item.label}</p>
                <p className="text-gray-400 text-xs">{item.sub}</p>
              </div>
              <span className="font-bold text-2xl">{calcular(item.taxa)}</span>
            </div>
          ))}
        </div>

        <button className="w-full bg-[#00FF5F] text-black font-black py-6 rounded-3xl mt-10 text-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,95,0.2)]">
          GERAR LINK DE COBRANÇA
        </button>
      </div>

      <p className="mt-10 text-gray-700 text-[9px] text-center max-w-[200px] uppercase tracking-widest font-bold opacity-50">
        Simulador independente. Taxas sujeitas a alteração sem aviso prévio.
      </p>
    </div>
  );
}
