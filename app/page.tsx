"use client";
import { useState } from 'react';

// 1. Definição de Tipos para o TypeScript
type PlanoNome = 'Ton Brother' | 'Gigaton' | 'Megaton';

interface Taxas {
  debito: number;
  credito: number;
  parcelado12x: number;
}

// 2. Tabela de Taxas (Valores decimais: 0.0099 = 0,99%)
const TAXAS_PLANOS: Record<PlanoNome, Taxas> = {
  'Ton Brother': { debito: 0.0099, credito: 0.0099, parcelado12x: 0.1299 },
  'Gigaton': { debito: 0.0179, credito: 0.0369, parcelado12x: 0.1599 },
  'Megaton': { debito: 0.0169, credito: 0.0349, parcelado12x: 0.1799 },
};

export default function SimuladorTon() {
  const [valor, setValor] = useState<string>('');
  const [plano, setPlano] = useState<PlanoNome>('Ton Brother');

  const valorNum = parseFloat(valor) || 0;
  const taxasAtuais = TAXAS_PLANOS[plano];

  // Função de cálculo: Valor Bruto - (Valor Bruto * Taxa)
  const calcularRecebimento = (taxa: number) => {
    const resultado = valorNum * (1 - taxa);
    return resultado.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center p-6 font-sans">
      {/* Logo Estilizada */}
      <h1 className="text-[#00FF5F] text-4xl font-black mb-8 italic tracking-tighter">TON</h1>

      <div className="bg-[#1E1E1E] w-full max-w-md rounded-3xl p-8 border border-gray-800 shadow-2xl">
        
        {/* Input de Valor */}
        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold">Valor da Venda</label>
        <div className="relative mt-2 mb-6">
          <span className="absolute left-0 top-1 text-[#00FF5F] text-2xl font-bold">R$</span>
          <input 
            type="number" 
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent text-5xl font-bold text-[#00FF5F] outline-none pl-10 border-b border-gray-800 pb-2 focus:border-[#00FF5F] transition-colors"
          />
        </div>

        {/* Seletor de Planos */}
        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold block mb-2">Seu Plano Atual</label>
        <select 
          value={plano}
          onChange={(e) => setPlano(e.target.value as PlanoNome)}
          className="w-full bg-[#2a2a2a] p-4 rounded-xl text-white outline-none mb-8 border border-gray-700 cursor-pointer focus:ring-2 focus:ring-[#00FF5F]"
        >
          {Object.keys(TAXAS_PLANOS).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <div>
              <p className="text-gray-500 text-xs uppercase">Débito</p>
              <p className="text-sm text-gray-300">Receba em 1 dia</p>
            </div>
            <span className="font-bold text-xl self-center">{calcularRecebimento(taxasAtuais.debito)}</span>
          </div>

          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <div>
              <p className="text-gray-500 text-xs uppercase">Crédito à Vista</p>
              <p className="text-sm text-gray-300">Receba em 1 dia</p>
            </div>
            <span className="font-bold text-xl self-center">{calcularRecebimento(taxasAtuais.credito)}</span>
          </div>

          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <div>
              <p className="text-gray-500 text-xs uppercase">Parcelado (12x)</p>
              <p className="text-sm text-gray-300">Receba tudo em 1 dia</p>
            </div>
            <span className="font-bold text-xl self-center">{calcularRecebimento(taxasAtuais.parcelado12x)}</span>
          </div>
        </div>

        {/* Botão de Ação */}
        <button className="w-full bg-[#00FF5F] text-black font-black py-5 rounded-2xl mt-8 hover:bg-[#00d64f] active:scale-95 transition-all uppercase tracking-tighter">
          Gerar Link de Cobrança
        </button>
      </div>

      <p className="mt-8 text-gray-600 text-[10px] text-center max-w-[250px] uppercase leading-tight">
        Simulador independente. As taxas podem ser alteradas pela operadora sem aviso prévio.
      </p>
    </div>
  );
}