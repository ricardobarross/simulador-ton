"use client";
import { useState } from 'react';

export default function SimuladorSurubim() {
  const [valor, setValor] = useState('100');

  // Cálculo direto das taxas (Sem funções complexas para não dar erro)
  const v = parseFloat(valor) || 0;
  const resDebito = (v * 0.9901).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  const resCredito = (v * 0.9901).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  const res12x = (v * 0.8701).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', padding: '20px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* LOGO SURUBIM */}
      <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '20px' }}>
        <h1 style={{ color: '#1E3A8A', fontSize: '32px', fontWeight: '900', margin: '0', letterSpacing: '-1px' }}>SURUBIM</h1>
        <p style={{ color: '#1E3A8A', fontSize: '12px', letterSpacing: '5px', margin: '0' }}>TORNEARIA</p>
      </div>

      <div style={{ backgroundColor: '#111', width: '100%', maxWidth: '400px', borderRadius: '30px', padding: '30px', border: '1px solid #222' }}>
        
        {/* INPUT */}
        <p style={{ color: '#666', fontSize: '10px', fontWeight: 'bold', margin: '0 0 10px 0' }}>VALOR DA VENDA</p>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #1E3A8A', marginBottom: '40px' }}>
          <span style={{ color: '#1E3A8A', fontSize: '24px', fontWeight: 'bold', marginRight: '10px' }}>R$</span>
          <input 
            type="number" 
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            style={{ bg: 'transparent', border: 'none', outline: 'none', color: '#1E3A8A', fontSize: '48px', fontWeight: 'bold', width: '100%', backgroundColor: 'transparent' }}
          />
        </div>

        {/* OPÇÕES FIXAS (Aparecem na hora) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#181818', borderRadius: '15px', borderLeft: '5px solid #1E3A8A' }}>
            <span style={{ color: '#888', fontWeight: 'bold', fontSize: '12px' }}>DÉBITO</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{resDebito}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#181818', borderRadius: '15px', borderLeft: '5px solid #1E3A8A' }}>
            <span style={{ color: '#888', fontWeight: 'bold', fontSize: '12px' }}>CRÉDITO À VISTA</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{resCredito}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#181818', borderRadius: '15px', borderLeft: '5px solid #1E3A8A' }}>
            <span style={{ color: '#888', fontWeight: 'bold', fontSize: '12px' }}>PARCELADO 12X</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1E3A8A' }}>{res12x}</span>
          </div>

        </div>

        <button style={{ width: '100%', backgroundColor: '#1E3A8A', color: '#fff', border: 'none', padding: '20px', borderRadius: '15px', marginTop: '30px', fontWeight: '900', cursor: 'pointer' }}>
          GERAR LINK DE COBRANÇA
        </button>
      </div>
    </div>
  );
}
