/**
 * thIAguinho ERP — Exportação Orçamento PMSP / Órgão Público
 *
 * Gera XLSX no formato exato da Planilha de Composição de Custos
 * exigida pela Polícia Militar de SP, Prefeituras e similares.
 *
 * Estrutura:
 *   - Cabeçalho institucional (multi-linha)
 *   - Identificação do orçamento (OES nº)
 *   - Dados da viatura (marca/modelo/ano/placa/chassis/patrimônio/km/prefixo)
 *   - Dados da empresa (razão social, CNPJ, endereço, orçamentista)
 *   - Dados do cliente (unidade, CNPJ, endereço, fiscal)
 *   - Tabela de SERVIÇOS: SISTEMA | DESCRIÇÃO | TMO | VALOR | DESC | VALOR FINAL
 *   - Tabela de PEÇAS: GRADE | CÓDIGO | DESCRIÇÃO | QTD | VALOR UNIT | DESC | VALOR FINAL
 *   - Totalizadores (peças, mão-de-obra, transportes, contrato)
 *   - Cidade/data + nome do orçamentista
 *
 * Powered by thIAguinho Soluções Digitais
 */
(function() {
  'use strict';

  window.exportarOrcamentoPMSP = async function() {
    if (typeof XLSX === 'undefined') {
      if (window.toast) window.toast('⚠ Biblioteca XLSX não carregou. Recarregue a página.', 'err');
      return;
    }

    const osId = document.getElementById('osId')?.value;
    if (!osId) {
      if (window.toast) window.toast('⚠ Salve a O.S. antes de exportar.', 'warn');
      return;
    }

    const os = (window.J?.os || []).find(o => o.id === osId);
    if (!os) {
      if (window.toast) window.toast('⚠ O.S. não encontrada.', 'err');
      return;
    }

    const cli = (window.J?.clientes || []).find(c => c.id === os.clienteId);
    if (!cli || cli.tipoCliente !== 'governo') {
      if (window.toast) window.toast('⚠ Esta exportação só funciona para clientes governamentais.', 'err');
      return;
    }

    const veiculo = (window.J?.veiculos || []).find(v => v.id === os.veiculoId);

    // Dados da empresa (oficina) — vem do tenant logado
    const tenant = window.J || {};
    const empresa = {
      razaoSocial: tenant.tnome || '',
      cnpj: tenant.cnpj || '',
      endereco: tenant.endereco || '',
      telefone: tenant.telefone || '',
      orcamentista: tenant.orcamentista || tenant.nome || '',
      representante: tenant.representante || tenant.nome || ''
    };

    // OES número — pega do padrão configurado no cliente (substitui ### pelo último ID curto)
    const oesNumero = (cli.govOesModelo || 'ORÇ ###/2026').replace(/###/g, os.id.slice(-3).toUpperCase());

    // Cabeçalho institucional (multi-linha do cliente)
    const cabecalhoLinhas = (cli.govCabecalho || '').split(/\r?\n/).filter(l => l.trim());

    // Calcula serviços e peças
    const valorHora = parseFloat(cli.govValorHora || 0);
    const descMO = parseFloat(cli.govDescMO || 0);
    const descPeca = parseFloat(cli.govDescPeca || 0);

    const servicos = (os.servicos || []).filter(s => s.desc);
    const pecas = (os.pecas || []).filter(p => p.desc);

    // Monta as linhas da planilha (array de arrays — formato xlsx)
    const linhas = [];

    // ═══ CABEÇALHO INSTITUCIONAL ═══
    cabecalhoLinhas.forEach(l => linhas.push([l]));
    linhas.push([]);
    linhas.push(['PLANILHA DE COMPOSIÇÃO DE CUSTOS']);
    linhas.push([`REFERÊNCIA: ORDEM E EXECUÇÃO DE SERVIÇOS Nº ${oesNumero}`]);
    linhas.push([]);

    // ═══ DADOS DA VIATURA ═══
    linhas.push(['DADOS DA VIATURA']);
    linhas.push([`MARCA: ${(veiculo?.marca || '').toUpperCase()}`, '', `MODELO: ${(veiculo?.modelo || '').toUpperCase()}`, '', `ANO: ${veiculo?.ano || ''}`, '', `PLACA: ${(veiculo?.placa || '').toUpperCase()}`]);
    linhas.push([`CHASSIS: ${(veiculo?.chassis || '').toUpperCase()}`, '', '', `PATRIMÔNIO: ${veiculo?.patrimonio || ''}`]);
    linhas.push([`KM: ${os.km || veiculo?.km || ''}`, '', `PREFIXO: ${veiculo?.prefixo || ''}`, '', `OPM DETENTORA: ${cli.govUnidade || ''}`]);
    linhas.push([]);

    // ═══ DADOS DA EMPRESA ═══
    linhas.push(['DADOS DA EMPRESA']);
    linhas.push([`RAZÃO SOCIAL: ${empresa.razaoSocial}`, '', '', '', `CNPJ: ${empresa.cnpj}`]);
    linhas.push([`ENDEREÇO: ${empresa.endereco}`]);
    linhas.push([`TELEFONE: ${empresa.telefone}`, '', '', `ORÇAMENTISTA: ${empresa.orcamentista}`]);
    linhas.push([`REPRESENTANTE LEGAL: ${empresa.representante}`]);
    linhas.push([]);

    // ═══ DADOS DO CLIENTE ═══
    linhas.push(['DADOS DO CLIENTE']);
    linhas.push([`UNIDADE: ${cli.govUnidade || cli.nome}`, '', '', '', `CNPJ: ${cli.doc || ''}`]);
    linhas.push([`ENDEREÇO: ${[cli.rua, cli.num, cli.bairro, cli.cidade].filter(Boolean).join(', ')}`]);
    linhas.push([]);
    linhas.push([`FISCAL DO CONTRATO: ${cli.govFiscal || ''}`]);
    linhas.push([]);

    // ═══ TABELA DE SERVIÇOS ═══
    linhas.push(['', 'DESCRIÇÃO DO SISTEMA', '', 'DESCRIÇÃO DO SERVIÇO', 'TMO', 'VALOR', 'DESC.', 'VALOR']);
    let totalMO = 0;
    let totalTMO = 0;
    servicos.forEach(s => {
      const tempo = parseFloat(s.tempo || 0);
      const valor = valorHora;
      const valorFinal = +(tempo * valor * (1 - descMO)).toFixed(2);
      totalMO += valorFinal;
      totalTMO += tempo;
      linhas.push([
        '',
        s.sistemaTabela || '',
        '',
        s.desc || '',
        tempo,
        valor,
        descMO,
        valorFinal
      ]);
    });
    linhas.push(['', '', '', 'TOTAL DE SERVIÇOS', totalTMO, '', '', +totalMO.toFixed(2)]);
    linhas.push([]);

    // ═══ TABELA DE PEÇAS ═══
    linhas.push(['GRADE', 'CÓDIGO DA PEÇA (CÓDIGO ORIGINAL)', '', 'DESCRIÇÃO', 'QTD', 'VALOR UNITÁRIO REGISTRADO', 'DESC', 'VALOR']);
    let totalPecas = 0;
    pecas.forEach(p => {
      const qtd = parseFloat(p.qtd || 1);
      const valor = parseFloat(p.valor || p.venda || 0);
      const valorFinal = +(qtd * valor * (1 - descPeca)).toFixed(2);
      totalPecas += valorFinal;
      linhas.push([
        '',
        p.codigo || '',
        '',
        p.desc || '',
        qtd,
        valor,
        descPeca,
        valorFinal
      ]);
    });
    linhas.push(['', '', '', '', 'TOTAL DE PEÇAS', '', '', +totalPecas.toFixed(2)]);
    linhas.push([]);

    // ═══ TOTALIZADORES ═══
    linhas.push(['TOTAL GERAL']);
    linhas.push(['VALOR DA VISTORIA TÉCNICA COMPLEMENTAR AO ESCOPO DE SERVIÇOS']);
    linhas.push(['VALOR TOTAL DE PEÇAS', '', '', '', '', '', '', +totalPecas.toFixed(2)]);
    linhas.push(['VALOR TOTAL DE MÃO DE OBRA', '', '', '', '', '', '', +totalMO.toFixed(2)]);
    linhas.push(['VALOR TRANSPORTES EM KM', '', '', '', '', '', '', +(parseFloat(os.transporteKm || 0)).toFixed(2)]);
    const valorContrato = +(totalPecas + totalMO + parseFloat(os.transporteKm || 0)).toFixed(2);
    linhas.push(['VALOR DO CONTRATO', '', '', '', '', '', '', valorContrato]);
    linhas.push([]);

    // ═══ DATA E ASSINATURA ═══
    const hoje = new Date();
    const meses = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    const dataExt = `${(cli.cidade || 'SÃO PAULO').toUpperCase()}, ${hoje.getDate()} DE ${meses[hoje.getMonth()]} DE ${hoje.getFullYear()}.`;
    linhas.push([dataExt]);
    linhas.push([]);
    linhas.push([empresa.representante.toUpperCase()]);
    linhas.push([]);
    linhas.push(['Powered by thIAguinho Soluções Digitais']);

    // Cria o workbook
    const ws = XLSX.utils.aoa_to_sheet(linhas);

    // Larguras de coluna razoáveis
    ws['!cols'] = [
      { wch: 8 },   // GRADE
      { wch: 28 },  // SISTEMA / CÓDIGO
      { wch: 4 },   //
      { wch: 50 },  // DESCRIÇÃO
      { wch: 8 },   // TMO/QTD
      { wch: 14 },  // VALOR
      { wch: 8 },   // DESC
      { wch: 14 }   // VALOR FINAL
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan1');

    // Nome do arquivo: PREFIXO_PLANILHA_DE_CUSTOS.xlsx
    const fname = `${(veiculo?.prefixo || os.id.slice(-6).toUpperCase())}_PLANILHA_DE_CUSTOS.xlsx`;

    XLSX.writeFile(wb, fname);

    if (window.toast) window.toast(`✓ Orçamento PMSP exportado: ${fname}`, 'ok');
  };
})();

/* Powered by thIAguinho Soluções Digitais */
