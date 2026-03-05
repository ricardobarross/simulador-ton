"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase (O código vai ler do seu arquivo .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type PlanoNome = 'Ton Brother' | 'Gigaton' | 'Megaton';

const TAXAS_PLANOS: Record<PlanoNome, { debito: number; credito: number; parcelado12x: number }> = {
  'Ton Brother': { debito: 0.0099, credito: 0.0099, parcelado12x: 0.1299 },
  'Gigaton': { debito: 0.0179, credito: 0.0369, parcelado12x: 0.1599 },
  'Megaton': { debito: 0.0169, credito: 0.0349, parcelado12x: 0.1799 },
};

export default function SimuladorTon() {
  const [valor, setValor] = useState('100');
  const [plano, setPlano] = useState<PlanoNome>('Ton Brother');
  const [loading, setLoading] = useState(false);

  const valorNum = parseFloat(valor) || 0;
  const taxas = TAXAS_PLANOS[plano];

  const calcular = (taxa: number) => valorNum * (1 - taxa);

  // FUNÇÃO PARA SALVAR NO SUPABASE
  const salvarNoBanco = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('simulacoes')
      .insert([
        { 
          valor_bruto: valorNum, 
          plano: plano,
          valor_debito: calcular(taxas.debito),
          valor_credito: calcular(taxas.credito),
          valor_12x: calcular(taxas.parcelado12x)
        }
      ]);

    if (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao conectar com o Supabase. Verifique as chaves.');
    } else {
      alert('Simulação salva com sucesso no banco de dados!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center p-6 font-sans">
      <h1 className="text-[#00FF5F] text-4xl font-black mb-8 italic">TON</h1>

      <div className="bg-[#1E1E1E] w-full max-w-md rounded-3xl p-8 border border-gray-800 shadow-2xl">
        <label className="text-gray-400 text-sm uppercase font-bold">Valor da Venda</label>
        <input 
          type="number" 
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-full bg-transparent text-5xl font-bold text-[#00FF5F] outline-none my-4 border-b border-gray-800 pb-2"
        />

        <label className="text-gray-400 text-sm uppercase font-bold block mt-4 mb-2">Selecione seu Plano</label>
        <select 
          value={plano}
          onChange={(e) => setPlano(e.target.value as PlanoNome)}
          className="w-full bg-[#2a2a2a] p-4 rounded-xl text-white outline-none mb-8 border border-gray-700"
        >
          <option value="Ton Brother">Ton Brother</option>
          <option value="Gigaton">Gigaton</option>
          <option value="Megaton">Megaton</option>
        </select>

        <div className="space-y-3">
          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <span className="text-gray-400">Débito</span>
            <span className="font-bold text-xl">{calcular(taxas.debito).toLocaleString('pt-br', {style: 'currency', currency: 'BRL'})}</span>
          </div>
          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <span className="text-gray-400">Crédito à Vista</span>
            <span className="font-bold text-xl">{calcular(taxas.credito).toLocaleString('pt-br', {style: 'currency', currency: 'BRL'})}</span>
          </div>
          <div className="flex justify-between p-4 bg-[#252525] rounded-xl border-l-4 border-[#00FF5F]">
            <span className="text-gray-400">Parcelado (12x)</span>
            <span className="font-bold text-xl">{calcular(taxas.parcelado12x).toLocaleString('pt-br', {style: 'currency', currency: 'BRL'})}</span>
          </div>
        </div>

        <button 
          onClick={salvarNoBanco}
          disabled={loading}
          className="w-full bg-[#00FF5F] text-black font-black py-5 rounded-2xl mt-8 hover:scale-105 transition-transform uppercase"
        >
          {loading ? 'Salvando...' : 'Gerar Link de Cobrança'}
        </button>
      </div>
    </div>
  );
}
