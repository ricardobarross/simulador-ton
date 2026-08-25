import { formatarMoeda } from '@/lib/utils'

export interface DadosDRE {
  receita_lancamentos: number
  receita_fiados: number
  receita_bruta: number
  custos_variaveis: number
  margem_contribuicao: number
  custos_fixos: number
  lucro_liquido: number
  margem_lucro_pct: number
}

function Linha({ label, valor, negrito, cor, indentado, ajuda }: {
  label: string; valor: number; negrito?: boolean; cor?: 'green' | 'red' | 'gray'; indentado?: boolean; ajuda?: string
}) {
  const corTexto = cor === 'green' ? 'text-green-600' : cor === 'red' ? 'text-red-500' : 'text-gray-900'
  return (
    <div className={`flex items-center justify-between py-2 ${indentado ? 'pl-4' : ''}`}>
      <div>
        <span className={negrito ? 'font-semibold text-gray-900' : 'text-gray-600'}>{label}</span>
        {ajuda && <p className="text-xs text-gray-400 mt-0.5">{ajuda}</p>}
      </div>
      <span className={`${negrito ? 'font-bold text-base' : 'font-medium'} ${corTexto}`}>{formatarMoeda(valor)}</span>
    </div>
  )
}

export function DRE({ dados }: { dados: DadosDRE }) {
  return (
    <div className="divide-y divide-gray-100">
      <Linha label="Receita Bruta" valor={dados.receita_bruta} negrito />
      <Linha label="Lançamentos (à vista/Pix/cartão)" valor={dados.receita_lancamentos} indentado cor="gray" />
      <Linha label="Fiados (vendas a prazo do mês)" valor={dados.receita_fiados} indentado cor="gray" />

      <Linha label="(–) Custos Variáveis" valor={-dados.custos_variaveis} cor="red" ajuda="Matéria-prima, ferramentas, serviços terceirizados" />
      <Linha label="= Margem de Contribuição" valor={dados.margem_contribuicao} negrito />

      <Linha label="(–) Custos Fixos" valor={-dados.custos_fixos} cor="red" ajuda="Contas fixas ativas: energia, aluguel, software..." />

      <div className="pt-3">
        <Linha
          label="Lucro Líquido Real"
          valor={dados.lucro_liquido}
          negrito
          cor={dados.lucro_liquido >= 0 ? 'green' : 'red'}
        />
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-gray-500">Margem de lucro</span>
          <span className={`text-sm font-semibold ${dados.margem_lucro_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {dados.margem_lucro_pct.toFixed(2).replace('.', ',')}%
          </span>
        </div>
      </div>
    </div>
  )
}
