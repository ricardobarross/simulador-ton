"use client";
import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

type Bandeira = 'visa' | 'mastercard' | 'elo' | 'amex';
type Modalidade = 'debito' | 'credito' | 'parcelado';
type TipoOperacao = 'cobrar' | 'receber';

// Taxas reais extraídas do app TON
const TAXAS: Record<Bandeira, { debito: number; credito: number; parcelado: Record<number, number> }> = {
  visa: {
    debito: 0.0198,
    credito: 0.0486,
    parcelado: {
      2: 0.1086, 3: 0.1224, 4: 0.1359, 5: 0.1492,
      6: 0.1622, 7: 0.1750, 8: 0.1876, 9: 0.1999,
      10: 0.2119, 11: 0.2139, 12: 0.2139,
    },
  },
  mastercard: {
    debito: 0.0198,
    credito: 0.0486,
    parcelado: {
      2: 0.1086, 3: 0.1224, 4: 0.1359, 5: 0.1492,
      6: 0.1622, 7: 0.1750, 8: 0.1876, 9: 0.1999,
      10: 0.2119, 11: 0.2139, 12: 0.2139,
    },
  },
  elo: {
    debito: 0.0317,
    credito: 0.0605,
    parcelado: {
      2: 0.1225, 3: 0.1363, 4: 0.1498, 5: 0.1631,
      6: 0.1761, 7: 0.1889, 8: 0.2015, 9: 0.2138,
      10: 0.2258, 11: 0.2278, 12: 0.2278,
    },
  },
  amex: {
    debito: 0.0317,
    credito: 0.0605,
    parcelado: {
      2: 0.1225, 3: 0.1363, 4: 0.1498, 5: 0.1631,
      6: 0.1761, 7: 0.1889, 8: 0.2015, 9: 0.2138,
      10: 0.2258, 11: 0.2278, 12: 0.2278,
    },
  },
};

const BANDEIRAS_INFO: Record<Bandeira, { label: string; cor: string; logo: string }> = {
  visa:       { label: 'Visa',       cor: '#1a1f71', logo: '💳' },
  mastercard: { label: 'Mastercard', cor: '#eb001b', logo: '💳' },
  elo:        { label: 'Elo',        cor: '#ffcb05', logo: '💳' },
  amex:       { label: 'Amex',       cor: '#2e77bc', logo: '💳' },
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (v: number) => (v * 100).toFixed(2).replace('.', ',') + '%';

export default function SimuladorTon() {
  const [valor, setValor] = useState('');
  const [bandeira, setBandeira] = useState<Bandeira>('visa');
  const [modalidade, setModalidade] = useState<Modalidade>('credito');
  const [parcelas, setParcelas] = useState(12);
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacao>('cobrar');
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const valorNum = parseFloat(valor.replace(',', '.')) || 0;
  const taxasBandeira = TAXAS[bandeira];

  const getTaxa = (mod: Modalidade, parc: number): number => {
    if (mod === 'debito') return taxasBandeira.debito;
    if (mod === 'credito') return taxasBandeira.credito;
    return taxasBandeira.parcelado[parc] ?? taxasBandeira.parcelado[12];
  };

  const taxa = getTaxa(modalidade, parcelas);

  // COBRAR: digita valor da venda → vê quanto recebe
  // RECEBER: digita quanto quer receber → vê quanto cobrar do cliente
  const clientePaga = tipoOperacao === 'cobrar' ? valorNum : valorNum / (1 - taxa);
  const voceRecebe  = tipoOperacao === 'cobrar' ? valorNum * (1 - taxa) : valorNum;
  const taxaEmReais = clientePaga - voceRecebe;

  const labelModalidade =
    modalidade === 'debito'  ? 'Débito' :
    modalidade === 'credito' ? 'Crédito à Vista' :
    `Parcelado ${parcelas}x`;

  // Linhas da tabela de parcelas
  const linhasParcelas = Object.entries(taxasBandeira.parcelado).map(([n, t]) => {
    const nNum = Number(n);
    if (tipoOperacao === 'cobrar') {
      return { n: nNum, taxa: t, principal: valorNum * (1 - t), parcela: valorNum / nNum };
    } else {
      const total = valorNum / (1 - t);
      return { n: nNum, taxa: t, principal: total, parcela: total / nNum };
    }
  });

  const handleGerarLink = async () => {
    if (valorNum <= 0) {
      setFeedback({ tipo: 'erro', msg: 'Digite um valor válido antes de gerar o link.' });
      return;
    }
    setSalvando(true);
    setFeedback(null);

    const valorBruto = tipoOperacao === 'cobrar' ? valorNum : clientePaga;

    const { error } = await supabase.from('simulacoes').insert({
      valor_bruto:   parseFloat(valorBruto.toFixed(2)),
      plano:         'Surubim Tornearia',
      valor_debito:  parseFloat((tipoOperacao === 'cobrar' ? valorNum * (1 - taxasBandeira.debito) : valorNum).toFixed(2)),
      valor_credito: parseFloat((tipoOperacao === 'cobrar' ? valorNum * (1 - taxasBandeira.credito) : valorNum).toFixed(2)),
      valor_12x:     parseFloat((tipoOperacao === 'cobrar' ? valorNum * (1 - taxasBandeira.parcelado[12]) : valorNum).toFixed(2)),
    });

    setSalvando(false);
    if (error) {
      console.error('Supabase error:', error);
      setFeedback({ tipo: 'erro', msg: 'Erro ao salvar. Tente novamente.' });
    } else {
      setFeedback({ tipo: 'sucesso', msg: '✓ Simulação salva com sucesso!' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d1a] text-white flex flex-col items-center justify-center p-4 font-sans">

      {/* Header */}
      <div className="mb-7 flex flex-col items-center">
        <div className="bg-white rounded-2xl px-6 py-3 shadow-[0_0_30px_#1a2a6c44] mb-3">
          <Image src="/logo.jpg" alt="Surubim Tornearia" width={220} height={70} className="object-contain" priority />
        </div>
        <p className="text-[#4a6fa5] text-[10px] uppercase tracking-widest">Simulador de Taxas · TON</p>
      </div>

      <div className="bg-[#0f1529] w-full max-w-md rounded-3xl p-6 border border-[#1e2d5a] shadow-2xl space-y-5">

        {/* Tipo de Operação */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-2">Tipo de Operação</label>
          <div className="grid grid-cols-2 gap-2">
            {(['cobrar', 'receber'] as TipoOperacao[]).map((op) => (
              <button key={op} onClick={() => { setTipoOperacao(op); setFeedback(null); }}
                className={`py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all border ${
                  tipoOperacao === op
                    ? 'bg-[#1a2fa8] text-white border-[#3a5fd4] shadow-[0_0_18px_#1a2fa855]'
                    : 'bg-[#131c3a] text-[#4a6fa5] border-[#1e2d5a] hover:bg-[#1a2440]'
                }`}>
                {op === 'cobrar' ? '💳 Quero Cobrar' : '💰 Quero Receber'}
              </button>
            ))}
          </div>
          <p className="text-[#2d3f6a] text-[10px] mt-2 leading-snug">
            {tipoOperacao === 'cobrar'
              ? 'Digite o valor da venda → veja quanto você recebe após a taxa.'
              : 'Digite quanto quer receber líquido → veja quanto cobrar do cliente.'}
          </p>
        </div>

        {/* Valor */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-1">
            {tipoOperacao === 'cobrar' ? 'Valor da venda' : 'Valor que deseja receber'}
          </label>
          <div className="flex items-center border-b border-[#1e2d5a] focus-within:border-[#3a5fd4] transition-colors pb-1">
            <span className="text-[#3a5fd4] text-2xl font-bold mr-2">R$</span>
            <input type="number" min="0" value={valor}
              onChange={(e) => { setValor(e.target.value); setFeedback(null); }}
              placeholder="0,00"
              className="flex-1 bg-transparent text-4xl font-bold text-[#3a7bd4] outline-none placeholder-[#1e2d5a]" />
          </div>
        </div>

        {/* Bandeira */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-2">Bandeira</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(TAXAS) as Bandeira[]).map((b) => (
              <button key={b} onClick={() => setBandeira(b)}
                className={`py-2 px-1 rounded-xl font-semibold text-xs uppercase transition-all border ${
                  bandeira === b
                    ? 'bg-[#1a2fa8] text-white border-[#3a5fd4] shadow-[0_0_10px_#1a2fa840]'
                    : 'bg-[#131c3a] text-[#4a6fa5] border-[#1e2d5a] hover:bg-[#1a2440]'
                }`}>
                {BANDEIRAS_INFO[b].label}
              </button>
            ))}
          </div>
        </div>

        {/* Modalidade */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-2">Modalidade</label>
          <div className="grid grid-cols-3 gap-2">
            {(['debito', 'credito', 'parcelado'] as Modalidade[]).map((m) => (
              <button key={m} onClick={() => setModalidade(m)}
                className={`py-2 px-1 rounded-xl font-semibold text-xs uppercase transition-all border ${
                  modalidade === m
                    ? 'bg-[#1a2fa8] text-white border-[#3a5fd4] shadow-[0_0_10px_#1a2fa840]'
                    : 'bg-[#131c3a] text-[#4a6fa5] border-[#1e2d5a] hover:bg-[#1a2440]'
                }`}>
                {m === 'debito' ? 'Débito' : m === 'credito' ? 'Crédito' : 'Parcelado'}
              </button>
            ))}
          </div>
        </div>

        {/* Resultado débito / crédito à vista */}
        {valorNum > 0 && modalidade !== 'parcelado' && (
          <div className="bg-[#0d1225] rounded-2xl p-4 border border-[#1e2d5a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Bandeira</span>
              <span className="text-white text-sm font-semibold">{BANDEIRAS_INFO[bandeira].label}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Modalidade</span>
              <span className="text-white text-sm font-semibold">{labelModalidade}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Taxa</span>
              <span className="text-yellow-400 font-bold">{pct(taxa)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Taxa em R$</span>
              <span className="text-red-400 font-bold">− {formatBRL(taxaEmReais)}</span>
            </div>
            <div className="h-px bg-[#1e2d5a]" />
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Cliente paga</span>
              <span className={`text-xl font-black ${tipoOperacao === 'receber' ? 'text-[#3a7bd4]' : 'text-white'}`}>
                {formatBRL(clientePaga)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Você recebe</span>
              <span className={`text-xl font-black ${tipoOperacao === 'cobrar' ? 'text-[#3a7bd4]' : 'text-white'}`}>
                {formatBRL(voceRecebe)}
              </span>
            </div>
          </div>
        )}

        {/* Tabela de parcelas */}
        {valorNum > 0 && modalidade === 'parcelado' && (
          <div className="bg-[#0d1225] rounded-2xl p-4 border border-[#1e2d5a] space-y-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold">
                {BANDEIRAS_INFO[bandeira].label} · Parcelado
              </span>
              <span className="text-[#4a6fa5] text-[10px]">
                {tipoOperacao === 'cobrar' ? `Venda: ${formatBRL(valorNum)}` : `Receber: ${formatBRL(valorNum)}`}
              </span>
            </div>

            {/* Cabeçalho */}
            <div className="grid grid-cols-4 text-[#2d3f6a] text-[9px] uppercase px-1 mb-1">
              <span>Parcelas</span>
              <span className="text-right">Taxa</span>
              <span className="text-right">{tipoOperacao === 'cobrar' ? 'Você recebe' : 'Cliente paga'}</span>
              <span className="text-right">Valor/parc.</span>
            </div>

            <div className="space-y-1.5">
              {linhasParcelas.map((l) => (
                <button key={l.n} onClick={() => setParcelas(l.n)}
                  className={`w-full grid grid-cols-4 items-center px-3 py-2 rounded-xl text-xs transition-all border ${
                    parcelas === l.n
                      ? 'bg-[#1a2fa8] border-[#3a5fd4] text-white'
                      : 'bg-[#131c3a] border-[#1e2d5a] text-[#7a9fd4] hover:bg-[#1a2440]'
                  }`}>
                  <span className="font-bold text-left">{l.n}x</span>
                  <span className="text-right text-yellow-400">{pct(l.taxa)}</span>
                  <span className="text-right font-bold">{formatBRL(l.principal)}</span>
                  <span className="text-right">{formatBRL(l.parcela)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ${
            feedback.tipo === 'sucesso'
              ? 'bg-[#0a1f5c] text-[#7aadff] border border-[#1a3a8a]'
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Botão */}
        <button onClick={handleGerarLink} disabled={salvando}
          className="w-full bg-[#1a2fa8] text-white font-black py-4 rounded-2xl hover:bg-[#2040c8] active:scale-95 transition-all uppercase tracking-tight text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-[#3a5fd4] shadow-[0_0_20px_#1a2fa833]">
          {salvando ? 'Salvando...' : 'Gerar Link de Cobrança'}
        </button>
      </div>

      <p className="mt-6 text-[#1e2d5a] text-[9px] text-center max-w-[260px] uppercase leading-tight">
        Simulador independente. As taxas podem ser alteradas pela operadora sem aviso prévio.
      </p>
    </div>
  );
}
