'use client';
import { useState } from 'react';

export default function SimuladorTonFiel() {
  const [etapa, setEtapa] = useState<'input' | 'resultado'>('input');
  const [modo, setModo] = useState<'cobrar' | 'receber'>('receber');
  const [valor, setValor] = useState<string>('100,00');
  const [formaPagamento, setFormaPagamento] = useState<'Crédito' | 'Débito'>('Crédito');
  const [bandeira, setBandeira] = useState('Visa');
  const [parcelas, setParcelas] = useState(12);
  const [modalAberto, setModalAberto] = useState<'pagamento' | 'bandeira' | 'parcelas' | null>(null);

  // Taxas Ton Pro (Ajustadas conforme seu print de 21,39% em 12x)
  const obterTaxa = (p: number) => {
    const isVisaMaster = bandeira === 'Visa' || bandeira === 'Mastercard';
    if (formaPagamento === 'Débito') return isVisaMaster ? 1.98 : 3.17;
    
    const tabelaVisaMaster = [4.86, 10.86, 12.24, 13.59, 14.92, 16.23, 17.65, 18.94, 20.21, 21.46, 22.69, 21.39]; 
    const tabelaEloAmex = [6.05, 12.25, 13.63, 14.98, 16.31, 17.61, 19.01, 20.29, 21.55, 22.78, 23.99, 25.19];

    return isVisaMaster ? tabelaVisaMaster[p - 1] : tabelaEloAmex[p - 1];
  };

  const formatarMoeda = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valorNum = parseFloat(valor.replace('.', '').replace(',', '.')) || 0;

  // Cálculo para a tela de resultado atual
  const taxaAtual = obterTaxa(parcelas);
  const valorPraReceber = modo === 'receber' ? valorNum : valorNum * (1 - taxaAtual / 100);
  const valorPraCobrar = modo === 'receber' ? valorNum / (1 - (taxaAtual / 100)) : valorNum;

  if (etapa === 'resultado') {
    return (
      <main className="min-h-screen bg-[#F0F2F5] flex flex-col items-center font-sans text-black">
        <div className="w-full bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => setEtapa('input')} className="text-gray-600 text-xl">←</button>
          <h1 className="text-lg font-bold text-gray-700 flex-1 text-center">Calculadora de taxas</h1>
        </div>

        <div className="w-full max-w-md p-4 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
            <h2 className="text-gray-700 font-bold mb-4">Resultado da simulação</h2>
            <div className="flex bg-[#E9ECEF] p-1 rounded-xl mb-6">
              <button onClick={() => setModo('cobrar')} className={`flex-1 py-2 rounded-lg font-bold ${modo === 'cobrar' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Cobrar</button>
              <button onClick={() => setModo('receber')} className={`flex-1 py-2 rounded-lg font-bold ${modo === 'receber' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Receber</button>
            </div>

            <p className="text-gray-500 text-sm">Pra receber</p>
            <p className="text-3xl font-black text-gray-800">R$ {formatarMoeda(valorPraReceber)}</p>
            <p className="text-[10px] text-gray-400 mb-6">1x de R$ {formatarMoeda(valorPraReceber)}</p>

            <p className="text-gray-500 text-sm">Você deveria cobrar</p>
            <p className="text-3xl font-black text-gray-800">R$ {formatarMoeda(valorPraCobrar)}</p>
            <p className="text-[10px] text-gray-400">{parcelas}x de R$ {formatarMoeda(valorPraCobrar / parcelas)}</p>
          </div>

          <button onClick={() => setModalAberto('parcelas')} className="w-full bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-gray-100 group active:bg-gray-50">
            <div className="text-left">
              <span className="text-gray-400 text-[10px] uppercase font-bold">Número de parcelas</span>
              <p className="text-gray-800 font-bold text-sm">{parcelas}x de R$ {formatarMoeda(valorPraCobrar/parcelas)}</p>
            </div>
            <span className="bg-[#32BC43] text-white px-4 py-2 rounded-lg font-bold text-xs uppercase">Ver mais parcelas</span>
          </button>

          <div className="bg-white p-4 rounded-2xl shadow-sm text-sm border border-gray-100">
            <div className="flex justify-between py-1"><span className="text-gray-500">Recebimento</span><span className="text-gray-700 font-medium">No mesmo dia</span></div>
            <div className="flex justify-between py-1"><span className="text-gray-500">Taxas da venda</span><span className="text-red-500 font-bold">R$ {formatarMoeda(valorPraCobrar - valorPraReceber)} ({taxaAtual}%)</span></div>
          </div>

          <button className="w-full bg-[#32BC43] text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-transform">
            <span>↗</span> Cobrar
          </button>
          <button onClick={() => setEtapa('input')} className="w-full bg-gray-200 text-gray-600 py-4 rounded-xl font-bold">Simular nova venda</button>
        </div>

        {/* MODAL DE PARCELAS DETALHADO */}
        {modalAberto === 'parcelas' && (
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end">
            <div className="bg-white rounded-t-3xl p-6 h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Número de parcelas</h3>
                <button onClick={() => setModalAberto(null)} className="text-gray-400 font-bold text-xs uppercase">Cancelar</button>
              </div>
              
              <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                  const taxaP = obterTaxa(num);
                  const cobrarP = modo === 'receber' ? valorNum / (1 - (taxaP / 100)) : valorNum;
                  return (
                    <div 
                      key={num} 
                      onClick={() => { setParcelas(num); setModalAberto(null); }}
                      className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${parcelas === num ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}
                    >
                      <div className="text-left">
                        <p className={`font-bold ${parcelas === num ? 'text-gray-800' : 'text-gray-600'}`}>
                          {num === 1 ? 'À vista' : `${num}x`} - R$ {formatarMoeda(cobrarP)}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {num}x de R$ {formatarMoeda(cobrarP / num)}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${parcelas === num ? 'border-green-500' : 'border-gray-300'}`}>
                        {parcelas === num && <div className="w-3 h-3 bg-green-500 rounded-full" />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setModalAberto(null)} className="w-full bg-[#32BC43] text-white py-4 rounded-xl font-bold mt-4 shadow-lg">Confirmar</button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // TELA DE INPUT (Mantenha o código anterior da tela de input aqui, mas use o modalAberto para bandeira e pagamento)
  return (
    <main className="min-h-screen bg-[#F0F2F5] flex flex-col items-center font-sans text-black relative">
      <div className="w-full bg-white p-4 flex items-center justify-between border-b border-gray-200">
        <span className="text-2xl text-gray-400">✕</span>
        <h1 className="text-lg font-bold text-gray-700">Calculadora de taxas</h1>
        <div className="w-6"></div>
      </div>

      <div className="w-full max-w-md p-4 space-y-4">
        <div className="bg-[#E9ECEF] p-1 rounded-xl flex">
          <button onClick={() => setModo('cobrar')} className={`flex-1 py-3 rounded-lg font-bold ${modo === 'cobrar' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Cobrar</button>
          <button onClick={() => setModo('receber')} className={`flex-1 py-3 rounded-lg font-bold ${modo === 'receber' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Receber</button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-center text-gray-500 text-sm mb-2">Quanto você quer {modo}?</p>
          <div className="border-2 border-green-500 rounded-xl p-4 flex items-center bg-white">
            <span className="text-2xl font-bold mr-2 text-gray-800">R$</span>
            <input 
              type="text" 
              value={valor} 
              onChange={(e) => setValor(e.target.value)} 
              className="w-full text-left text-3xl font-bold outline-none bg-transparent text-gray-800"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm divide-y border border-gray-100 font-sans">
          <div className="p-4 font-bold text-gray-800">Personalize sua simulação</div>
          <OptionRow label="Onde será a venda?" value="Ton Pro | até R$2 mil" />
          <OptionRow label="Forma de pagamento" value={formaPagamento} onClick={() => setModalAberto('pagamento')} />
          <OptionRow label="Bandeira" value={bandeira} onClick={() => setModalAberto('bandeira')} />
          <OptionRow label="Número de parcelas" value={parcelas === 1 ? 'À vista' : `${parcelas}x`} onClick={() => setModalAberto('parcelas')} />
          <OptionRow label="Prazo pra receber" value="No mesmo dia" />
        </div>

        <button onClick={() => setEtapa('resultado')} className="w-full bg-[#32BC43] text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Simular venda</button>
      </div>

      {/* MODAL GERAL (PAGAMENTO E BANDEIRA) */}
      {(modalAberto === 'pagamento' || modalAberto === 'bandeira' || (modalAberto === 'parcelas' && etapa === 'input')) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-800 uppercase text-sm">
                {modalAberto === 'pagamento' ? 'Forma de pagamento' : modalAberto === 'bandeira' ? 'Bandeira' : 'Parcelas'}
              </h3>
              <button onClick={() => setModalAberto(null)} className="text-gray-400 font-bold text-xs">FECHAR</button>
            </div>
            
            <div className="overflow-y-auto space-y-2 pb-4">
              {modalAberto === 'bandeira' && ['Visa', 'Mastercard', 'Elo', 'American Express'].map(opt => (
                <RadioButton key={opt} label={opt} selected={bandeira === opt} onClick={() => {setBandeira(opt); setModalAberto(null);}} />
              ))}
              {modalAberto === 'pagamento' && ['Crédito', 'Débito'].map(opt => (
                <RadioButton key={opt} label={opt} selected={formaPagamento === opt} onClick={() => {setFormaPagamento(opt as any); setModalAberto(null);}} />
              ))}
              {modalAberto === 'parcelas' && [1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                <RadioButton key={num} label={num === 1 ? 'À vista' : `${num}x`} selected={parcelas === num} onClick={() => {setParcelas(num); setModalAberto(null);}} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Funções Auxiliares permanecem as mesmas
function OptionRow({ label, value, onClick }: any) {
  return (
    <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={onClick}>
      <div><p className="text-[10px] text-gray-400 uppercase font-bold">{label}</p><p className="text-gray-800 font-bold">{value}</p></div>
      <span className="text-green-500 font-bold text-sm">Alterar</span>
    </div>
  );
}

function RadioButton({ label, selected, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${selected ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}>
      <span className={`font-medium ${selected ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'border-green-500' : 'border-gray-300'}`}>
        {selected && <div className="w-3 h-3 bg-green-500 rounded-full" />}
      </div>
    </div>
  );
}
