"use client";
import { useState } from 'react';

export default function SimuladorTon() {
  const [valor, setValor] = useState('');
  const [plano, setPlano] = useState('ton-brother'); // Exemplo de plano

  // Simulação básica de taxas (Exemplo: 12x no Ton Brother)
  const taxa12x = 0.1299; 
  const totalReceber = valor ? parseFloat(valor) * (1 - taxa12x) : 0;

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center p-6 font-sans">
      {/* Header */}
      <div className="w-full max-w-md flex justify-center mb-8">
        <h1 className="text-[#00FF5F] text-3xl font-bold tracking-tighter">TON</h1>
      </div>

      {/* Card de Simulação */}
      <div className="bg-[#1E1E1E] w-full max-w-md rounded-2xl p-6 border border-gray-800 shadow-xl">
        <label className="block text-gray-400 text-sm mb-2">Valor da venda</label>
        <input 
          type="number" 
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="R$ 0,00"
          className="w-full bg-transparent text-4xl font-bold text-[#00FF5F] outline-none mb-6 border-b border-gray-700 pb-2"
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#2a2a2a] p-4 rounded-xl">
            <span className="text-gray-300">Total a receber (12x)</span>
            <span className="text-[#00FF5F] font-bold text-xl">
              {totalReceber.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <button 
          className="w-full bg-[#00FF5F] text-black font-bold py-4 rounded-full mt-8 hover:bg-[#00d64f] transition-all uppercase tracking-widest"
          onClick={() => alert('Simulação salva no seu Supabase!')}
        >
          Criar link de cobrança
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-xs text-center max-w-xs">
        As taxas podem variar conforme o seu plano atual no Ton.
      </p>
    </div>
  );
}