"use client";
import { useState, useEffect } from 'react';

type PlanoNome = 'Ton Brother' | 'Gigaton' | 'Megaton';

const TAXAS_PLANOS: Record<PlanoNome, { debito: number; credito: number; parcelado12x: number }> = {
  'Ton Brother': { debito: 0.0099, credito: 0.0099, parcelado12x: 0.1299 },
  'Gigaton': { debito: 0.0179, credito: 0.0369, parcelado12x: 0.1599 },
  'Megaton': { debito: 0.0169, credito: 0.0349, parcelado12x: 0.1799 },
};

export default function SimuladorTon() {
  const [valor, setValor] = useState('100');
  const [plano, setPlano] = useState<PlanoNome>('Ton Brother');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  if (!isClient) return null;

  const valorNum = parseFloat(valor) || 0;
  const taxas = TAXAS_PLANOS[plano];

  const calcular = (taxa: number) => (valorNum * (1 - taxa)).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col items-center p-6 font-sans">
      <h1 className="text-[#00FF5F] text-5xl font-black mb-10 italic tracking-tighter">TON</h1>
      <div className="bg-[#181818] w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-white/5">
        <label className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black">Valor da Venda</label>
        <input 
          type="number" 
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="bg-transparent text-6xl font-bold text-[#00FF5F] outline-none w-full border-b border-white/10 pb-4 mb-8"
        />
        <label className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black block mb-3">Seu Plano Atual</label>
        <select 
          value={plano}
          onChange={(e) => setPlano(e.target.value as PlanoNome)}
          className="w-full bg-[#252525] p-5 rounded-2xl text-white outline-none mb-10 border border-white/5 text-lg"
        >
          <option value="Ton Brother">Ton Brother</option>
          <option value="Gigaton">Gigaton</option>
          <option value="Megaton">Megaton</option>
        </select>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-5 bg-[#202020] rounded-3xl border-l-[6px] border-[#00FF5F]">
            <div><p className="text-gray-500 text-[10px] uppercase font-black">Débito</p></div>
            <span className="font-bold text-2xl">{calcular(taxas.debito)}</span>
          </div>
          <div className="flex justify-between items-center p-5 bg-[#202020] rounded-3xl border-l-[6px] border-[#00FF5F]">
            <div><p className="text-gray-500 text-[10px] uppercase font-black">Crédito à Vista</p></div>
            <span className="font-bold text-2xl">{calcular(taxas.credito)}</span>
          </div>
          <div className="flex justify-between items-center p-5 bg-[#202020] rounded-3xl border-l-[6px] border-[#00FF5F]">
            <div><p className="text-gray-500 text-[10px] uppercase font-black">Parcelado (12x)</p></div>
            <span className="font-bold text-2xl">{calcular(taxas.parcelado12x)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
