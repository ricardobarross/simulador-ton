"use client";
import { useState, useEffect } from 'react';

// === CONFIGURAÇÃO DE TAXAS DA SURUBIM ===
// Estas são as taxas exatas baseadas nos dados que você compartilhou.
// Se as taxas mudarem, é só alterar estes números. (0.0099 = 0,99%)
const TAXAS_SURUBIM = {
  debito: 0.0099,       // Taxa para débito
  creditoVista: 0.0099,  // Taxa para crédito à vista
  parcelado12x: 0.1299, // Taxa para crédito parcelado em 12x
};

export default function SimuladorSurubim() {
  const [valor, setValor] = useState('100');
  const [isClient, setIsClient] = useState(false);

  // Garante que o cálculo e a tipagem funcionem após o carregamento da página
  useEffect(() => { setIsClient(true); }, []);

  const valorNum = parseFloat(valor) || 0;
  
  // Função para calcular o valor líquido a receber
  const calcularLíquido = (taxa: number) => {
    const resultado = valorNum * (1 - taxa);
    // Retorna formatado como moeda brasileira (R$)
    return resultado.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  };

  // Enquanto o cliente não carrega, mostramos uma tela preta para evitar piscadas
  if (!isClient) return <div className="min-h-screen bg-[#000000]"></div>;

  return (
    // Fundo Totalmente Preto
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center p-6 font-sans">
      
      {/* Header com a Nova Logo (Azul Surubim) */}
      <div className="flex items-center gap-3 mb-10 mt-6 group">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <div className="flex flex-col text-[#1E3A8A]">
          <span className="text-sm font-light uppercase tracking-[0.2em]">Surubim</span>
          <span className="text-3xl font-black uppercase tracking-tighter">Tornearia</span>
        </div>
      </div>

      {/* Card da Simulação */}
      <div className="bg-[#111111] w-full max-w-md rounded-[40px] p-9 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] border border-white/5">
        
        {/* Campo de Entrada de Valor */}
        <label className="text-gray-500 text-[11px] uppercase tracking-[0.3em] font-black">Valor da Venda</label>
        <div className="flex items-baseline gap-1 mt-3 mb-12 border-b-2 border-[#1E3A8A]/30 pb-4">
          <span className="text-[#1E3A8A] text-2xl font-bold">R$</span>
          <input 
            type="number" 
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="bg-transparent text-7xl font-bold text-[#1E3A8A] outline-none w-full"
            placeholder="0,00"
          />
        </div>

        {/* Resultados das Taxas (Sem Seletor de Planos) */}
        <div className="space-y-4">
          
          {/* Resultado Débito */}
          <div className="flex justify-between items-center p-6 bg-[#181818] rounded-3xl border-l-[8px] border-[#1E3A8A]">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Débito</p>
              <p className="text-gray-400 text-xs">Receba em 1 dia útil</p>
            </div>
            <span className="font-bold text-3xl">{calcularLíquido(TAXAS_SURUBIM.debito)}</span>
          </div>

          {/* Resultado Crédito à Vista */}
          <div className="flex justify-between items-center p-6 bg-[#181818] rounded-3xl border-l-[8px] border-[#1E3A8A]">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Crédito à Vista</p>
              <p className="text-gray-400 text-xs">Receba em 1 dia útil</p>
            </div>
            <span className="font-bold text-3xl">{calcularLíquido(TAXAS_SURUBIM.creditoVista)}</span>
          </div>

          {/* Resultado Parcelado 12x */}
          <div className="flex justify-between items-center p-6 bg-[#181818] rounded-3xl border-l-[8px] border-[#1E3A8A]">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Parcelado (12x)</p>
              <p className="text-gray-400 text-xs">Receba tudo em 1 dia útil</p>
            </div>
            <span className="font-bold text-3xl">{calcularLíquido(TAXAS_SURUBIM.parcelado12x)}</span>
          </div>

        </div>

        {/* Botão de Ação (Azul Surubim) */}
        <button className="w-full bg-[#1E3A8A] text-white font-black py-6 rounded-3xl mt-12 text-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_10px_30px_rgba(30,58,138,0.3)] uppercase tracking-tight">
          CRIAR LINK DE COBRANÇA
        </button>
      </div>

      {/* Rodapé (Surubim Tornearia) */}
      <p className="mt-12 text-gray-700 text-[10px] text-center max-w-[250px] uppercase tracking-[0.3em] font-bold opacity-60">
        Surubim Tornearia © 2024. Todos os direitos reservados.
      </p>
    </div>
  );
}
