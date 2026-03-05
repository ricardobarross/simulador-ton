"use client";
import { useState } from 'react';

export default function SimuladorSurubim() {
  const [valor, setValor] = useState('100');

  // TAXAS FIXAS (Altere aqui se precisar)
  const taxaDebito = 0.0099;
  const taxaCredito = 0.0099;
  const taxa12x = 0.1299;

  const valorNum = parseFloat(valor) || 0;

  const calcular = (taxa: number) => 
    (valorNum * (1 - taxa)).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6">
      
      {/* LOGO SURUBIM */}
      <div className="flex flex-col items-center mb-8 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#1E3A8A] rounded-lg flex items-center justify-center font-black text-black text-2xl">S</div>
          <h1 className="text-[#1E3A8A] text-3xl font-black uppercase tracking-tighter">Surubim</h1>
        </div>
        <p className="text-[#1E3A8A] text-sm tracking-[0.4em] font-light -mt-1">TORNEARIA</p>
      </div>

      <div className="bg-[#111111] w-full max-w-md rounded-[35px] p-8 border border-white/5 shadow-2xl">
        
        {/* INPUT DE VALOR */}
        <label className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Valor da Venda</label>
        <div className="flex items-baseline gap-2 mb-10 border-b border-[#1E3A8A]/50 pb-2">
          <span className="text-[#1E3A8A] text-2xl font-bold">R$</span>
          <input 
            type="number" 
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="bg-transparent text-6xl font-bold text-[#1E3A8A] outline-none w-full"
          />
        </div>

        {/* OPÇÕES FIXAS (DÉBITO, CRÉDITO, 12X) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center p-5 bg-[#181818] rounded-2xl border-l-4 border-[#1E3A8A]">
            <span className="text-gray-400 font-bold uppercase text-xs">Débito</span>
            <span className="text-2xl font-bold text-white">{calcular(taxaDebito)}</span>
          </div>

          <div className="flex justify-between items-center p-5 bg-[#181818] rounded-2xl border-l-4 border-[#1E3A8A]">
            <span className="text-gray-400 font-bold uppercase text-xs">Crédito à Vista</span>
            <span className="text-2xl font-bold text-white">{calcular(taxaCredito)}</span>
          </div>

          <div className="flex justify-between items-center p-5 bg-[#181818] rounded-2xl border-l-4 border-[#1E3A8A]">
            <span className="text-gray-400 font-bold uppercase text-xs">Parcelado 12x</span>
            <span className="text-2xl font-bold text-[#1E3A8A]">{calcular(taxa12x)}</span>
          </div>
        </div>

        <button className="w-full bg-[#1E3A8A] text-white font-black py-5 rounded-2xl mt-10 hover:brightness-125 transition-all">
          GERAR LINK DE COBRANÇA
        </button>
      </div>

      <p className="mt-10 text-gray-800 text-[9px] font-bold uppercase tracking-widest">
        Surubim Tornearia © 2026
      </p>
    </div>
  );
}
