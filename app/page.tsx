"use client";
import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

type Modalidade = 'debito' | 'credito' | 'parcelado';
type TipoOperacao = 'cobrar' | 'receber';

const TAXAS = {
  debito: 0.0099,
  credito: 0.0099,
  parcelado: {
    2: 0.0299, 3: 0.0399, 4: 0.0499, 5: 0.0599,
    6: 0.0699, 7: 0.0799, 8: 0.0899, 9: 0.0999,
    10: 0.1099, 11: 0.1199, 12: 0.1299,
  } as Record<number, number>,
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SimuladorTon() {
  const [valor, setValor] = useState('');
  const [modalidade, setModalidade] = useState<Modalidade>('credito');
  const [parcelas, setParcelas] = useState(12);
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacao>('cobrar');
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const valorNum = parseFloat(valor.replace(',', '.')) || 0;

  const getTaxa = (mod: Modalidade, parc: number): number => {
    if (mod === 'debito') return TAXAS.debito;
    if (mod === 'credito') return TAXAS.credito;
    return TAXAS.parcelado[parc] ?? TAXAS.parcelado[12];
  };

  const taxa = getTaxa(modalidade, parcelas);

  /*
   * COBRAR: você digita o valor da venda (bruto)
   *   → você recebe = valorNum × (1 - taxa)
   *   → cliente paga = valorNum  (o que foi digitado)
   *
   * RECEBER: você digita quanto quer receber líquido
   *   → cliente paga = valorNum / (1 - taxa)   ← gross-up
   *   → você recebe  = valorNum  (o que foi digitado)
   */
  const clientePaga = tipoOperacao === 'cobrar'
    ? valorNum
    : valorNum / (1 - taxa);

  const voceRecebe = tipoOperacao === 'cobrar'
    ? valorNum * (1 - taxa)
    : valorNum;

  const taxaEmReais = clientePaga - voceRecebe;
  const taxaPercent = (taxa * 100).toFixed(2).replace('.', ',');

  // Para o resumo salvo no Supabase sempre usamos o valor bruto (clientePaga)
  const valorBruto = tipoOperacao === 'cobrar' ? valorNum : clientePaga;

  const calcResumo = (mod: Modalidade, parc = 12) => {
    const t = getTaxa(mod, parc);
    return tipoOperacao === 'cobrar'
      ? valorNum * (1 - t)          // recebe após taxa sobre o bruto digitado
      : valorNum;                   // recebe o líquido digitado (não muda por modalidade no resumo)
  };

  // Resumo das 3 colunas salvas no banco
  const resumoDebito  = tipoOperacao === 'cobrar'
    ? valorNum * (1 - TAXAS.debito)
    : valorNum;
  const resumoCredito = tipoOperacao === 'cobrar'
    ? valorNum * (1 - TAXAS.credito)
    : valorNum;
  const resumo12x     = tipoOperacao === 'cobrar'
    ? valorNum * (1 - TAXAS.parcelado[12])
    : valorNum;

  const labelModalidade =
    modalidade === 'debito'  ? 'Débito' :
    modalidade === 'credito' ? 'Crédito à Vista' :
    `Parcelado ${parcelas}x`;

  // Gera linhas de parcelas para exibir quando modalidade = parcelado
  const linhasParcelas = tipoOperacao === 'receber'
    ? Object.entries(TAXAS.parcelado).map(([n, t]) => ({
        n: Number(n),
        clientePagaParcela: (valorNum / (1 - t)) / Number(n),
        clientePagaTotal:   valorNum / (1 - t),
        taxa: t,
      }))
    : Object.entries(TAXAS.parcelado).map(([n, t]) => ({
        n: Number(n),
        voceRecebeTotal: valorNum * (1 - t),
        valorParcela:    valorNum / Number(n),
        taxa: t,
      }));

  const handleGerarLink = async () => {
    if (valorNum <= 0) {
      setFeedback({ tipo: 'erro', msg: 'Digite um valor válido antes de gerar o link.' });
      return;
    }
    setSalvando(true);
    setFeedback(null);

    const { error } = await supabase.from('simulacoes').insert({
      valor_bruto:   parseFloat(valorBruto.toFixed(2)),
      plano:         'Surubim Tornearia',
      valor_debito:  parseFloat(resumoDebito.toFixed(2)),
      valor_credito: parseFloat(resumoCredito.toFixed(2)),
      valor_12x:     parseFloat(resumo12x.toFixed(2)),
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
          <Image
            src="/logo.jpg"
            alt="Surubim Tornearia"
            width={220}
            height={70}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-[#4a6fa5] text-[10px] uppercase tracking-widest">
          Simulador de Taxas · TON
        </p>
      </div>

      <div className="bg-[#0f1529] w-full max-w-md rounded-3xl p-6 border border-[#1e2d5a] shadow-2xl space-y-5">

        {/* Tipo de Operação */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-2">
            Tipo de Operação
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['cobrar', 'receber'] as TipoOperacao[]).map((op) => (
              <button
                key={op}
                onClick={() => { setTipoOperacao(op); setFeedback(null); }}
                className={`py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all border ${
                  tipoOperacao === op
                    ? 'bg-[#1a2fa8] text-white shadow-[0_0_18px_#1a2fa855] border-[#3a5fd4]'
                    : 'bg-[#131c3a] text-[#4a6fa5] hover:bg-[#1a2440] border-[#1e2d5a]'
                }`}
              >
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
            <input
              type="number"
              min="0"
              value={valor}
              onChange={(e) => { setValor(e.target.value); setFeedback(null); }}
              placeholder="0,00"
              className="flex-1 bg-transparent text-4xl font-bold text-[#3a7bd4] outline-none placeholder-[#1e2d5a]"
            />
          </div>
        </div>

        {/* Modalidade */}
        <div>
          <label className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold block mb-2">
            Modalidade
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['debito', 'credito', 'parcelado'] as Modalidade[]).map((m) => (
              <button
                key={m}
                onClick={() => setModalidade(m)}
                className={`py-2 px-1 rounded-xl font-semibold text-xs uppercase transition-all border ${
                  modalidade === m
                    ? 'bg-[#1a2fa8] text-white border-[#3a5fd4] shadow-[0_0_12px_#1a2fa840]'
                    : 'bg-[#131c3a] text-[#4a6fa5] border-[#1e2d5a] hover:bg-[#1a2440]'
                }`}
              >
                {m === 'debito' ? 'Débito' : m === 'credito' ? 'Crédito' : 'Parcelado'}
              </button>
            ))}
          </div>
        </div>

        {/* Resultado principal (débito ou crédito à vista) */}
        {valorNum > 0 && modalidade !== 'parcelado' && (
          <div className="bg-[#0d1225] rounded-2xl p-4 border border-[#1e2d5a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Modalidade</span>
              <span className="text-white text-sm font-semibold">{labelModalidade}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#4a6fa5] text-xs uppercase">Taxa</span>
              <span className="text-yellow-400 font-bold">{taxaPercent}%</span>
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
            <p className="text-[#4a6fa5] text-[10px] uppercase tracking-widest font-bold">
              {tipoOperacao === 'cobrar'
                ? 'Valor da venda: ' + formatBRL(valorNum) + ' → você recebe:'
                : 'Você quer receber: ' + formatBRL(valorNum) + ' → cliente paga:'}
            </p>

            <div className="space-y-1.5">
              {/* Cabeçalho */}
              <div className="grid grid-cols-4 text-[#2d3f6a] text-[9px] uppercase px-1">
                <span>Parcelas</span>
                <span className="text-right">Taxa</span>
                <span className="text-right">
                  {tipoOperacao === 'cobrar' ? 'Você recebe' : 'Cliente paga'}
                </span>
                <span className="text-right">Valor/parc.</span>
              </div>

              {tipoOperacao === 'cobrar'
                ? (linhasParcelas as { n: number; voceRecebeTotal: number; valorParcela: number; taxa: number }[]).map((l) => (
                    <button
                      key={l.n}
                      onClick={() => setParcelas(l.n)}
                      className={`w-full grid grid-cols-4 items-center px-3 py-2 rounded-xl text-xs transition-all border ${
                        parcelas === l.n
                          ? 'bg-[#1a2fa8] border-[#3a5fd4] text-white'
                          : 'bg-[#131c3a] border-[#1e2d5a] text-[#7a9fd4] hover:bg-[#1a2440]'
                      }`}
                    >
                      <span className="font-bold text-left">{l.n}x</span>
                      <span className="text-right text-yellow-400">{(l.taxa * 100).toFixed(2).replace('.', ',')}%</span>
                      <span className="text-right font-bold">{formatBRL(l.voceRecebeTotal)}</span>
                      <span className="text-right">{formatBRL(l.valorParcela)}</span>
                    </button>
                  ))
                : (linhasParcelas as { n: number; clientePagaTotal: number; clientePagaParcela: number; taxa: number }[]).map((l) => (
                    <button
                      key={l.n}
                      onClick={() => setParcelas(l.n)}
                      className={`w-full grid grid-cols-4 items-center px-3 py-2 rounded-xl text-xs transition-all border ${
                        parcelas === l.n
                          ? 'bg-[#1a2fa8] border-[#3a5fd4] text-white'
                          : 'bg-[#131c3a] border-[#1e2d5a] text-[#7a9fd4] hover:bg-[#1a2440]'
                      }`}
                    >
                      <span className="font-bold text-left">{l.n}x</span>
                      <span className="text-right text-yellow-400">{(l.taxa * 100).toFixed(2).replace('.', ',')}%</span>
                      <span className="text-right font-bold">{formatBRL(l.clientePagaTotal)}</span>
                      <span className="text-right">{formatBRL(l.clientePagaParcela)}</span>
                    </button>
                  ))
              }
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
        <button
          onClick={handleGerarLink}
          disabled={salvando}
          className="w-full bg-[#1a2fa8] text-white font-black py-4 rounded-2xl hover:bg-[#2040c8] active:scale-95 transition-all uppercase tracking-tight text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-[#3a5fd4] shadow-[0_0_20px_#1a2fa833]"
        >
          {salvando ? 'Salvando...' : 'Gerar Link de Cobrança'}
        </button>
      </div>

      <p className="mt-6 text-[#1e2d5a] text-[9px] text-center max-w-[260px] uppercase leading-tight">
        Simulador independente. As taxas podem ser alteradas pela operadora sem aviso prévio.
      </p>
    </div>
  );
}
