const socket = io();
const $ = id => document.getElementById(id);
let jogadorAtualId = 0;
let jogadores = [];

// ===== TABULEIRO COM IMAGEM =====
function atualizarTabuleiroImagem(listaJogadores, idJogadorDaVez) {
  const container = document.getElementById('tabuleiroImagem');
  if (!container) return;

  container.querySelectorAll('.peca-jogador').forEach(p => p.remove());

  listaJogadores.forEach(j => {
    if (j.casa <= 0) return;
    const coords = getCoordenadaCasa(j.casa);
    const peca = document.createElement('div');
    const corIndex = (j.id % 6) + 1;
    peca.className = `peca-jogador peca-jogador-${corIndex}`;
    if (j.id === idJogadorDaVez) {
      peca.classList.add('destaque');
    }
    peca.style.left = coords.x + '%';
    peca.style.top = coords.y + '%';
    peca.title = j.nome + ' (Casa ' + j.casa + ')';
    container.appendChild(peca);
  });
}

function gerarLegenda(listaJogadores) {
  const legenda = document.getElementById('legenda');
  if (!legenda) return;
  const cores = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00'];
  legenda.innerHTML = listaJogadores.map((j, i) => `<div class="legenda-item"> <div class="legenda-cor" style="background:${cores[i % cores.length]}"></div> <span>${j.nome}</span> </div>`).join('');
}

// ===== BOTÕES =====
$('btnCriar').onclick = () => {
  const num = parseInt($('numJogadores').value);
  if (num >= 2 && num <= 6) {
    socket.emit('criarSala', num);
  }
};

$('btnIniciarTurno').onclick = () => {
  console.log('Rolando dado...');
  socket.emit('iniciarTurno');
};

$('btnAcerto').onclick = () => socket.emit('julgamento', true);
$('btnErro').onclick = () => socket.emit('julgamento', false);
$('btnProximo').onclick = () => socket.emit('proximoJogador');
$('btnPular').onclick = () => socket.emit('proximoJogador');

$('btnEncerrar').onclick = () => {
  if (confirm('Encerrar o jogo?')) {
    socket.emit('encerrarJogo');
  }
};

// ===== EVENTOS DO SOCKET =====
socket.on('salaCriada', ({ codigo }) => {
  console.log('Sala criada:', codigo);
  $('config').style.display = 'none';
  $('jogo').style.display = 'block';
  $('codigoSala').textContent = codigo;
});

socket.on('jogadoresAtualizados', (lista) => {
  console.log('Jogadores atualizados:', lista);
  jogadores = lista;
  $('contadorJogadores').textContent = lista.length;
  $('tabuleiroMini').innerHTML = '<h4>Posições:</h4>' +
    lista.map(j => '<div class="jogador-mini">🎲 ' + j.nome + ' (casa ' + j.casa + ')</div>').join('');
  gerarLegenda(lista);
  atualizarTabuleiroImagem(lista, jogadorAtualId);
});

socket.on('turnoIniciado', ({ jogador, jogadorId, dado, casa, pergunta, semPergunta }) => {
  console.log('Turno iniciado:', { jogador, dado, casa, semPergunta });
  jogadorAtualId = jogadorId;
  $('areaTurno').style.display = 'block';
  $('areaResultado').style.display = 'none';
  $('btnIniciarTurno').style.display = 'none';

  atualizarTabuleiroImagem(jogadores, jogadorId);

  if (semPergunta) {
    $('textoPergunta').textContent =
      '🎯 Vez de ' + jogador + '\n' +
      '🎲 Dado: ' + dado + '\n' +
      '📍 Casa: ' + casa + '\n\n' +
      '⚠️ Não há pergunta para esta casa.\n' +
      'O jogador permanece na casa ' + casa + '.';
    $('respostaSecreta').innerHTML = '<em>Nenhuma pergunta disponível. Clique em "Passar Vez" para continuar.</em>';
    $('botoesJulgamento').style.display = 'none';
    $('btnPular').style.display = 'inline-block';
  } else {
    $('textoPergunta').textContent =
      '🎯 Vez de ' + jogador + '\n' +
      '🎲 Dado: ' + dado + '\n' +
      '📍 Casa: ' + casa + '\n\n' +
      pergunta.texto;
    $('respostaSecreta').textContent = '';
    $('botoesJulgamento').style.display = 'flex';
    $('btnPular').style.display = 'none';
  }
});

socket.on('respostaSecreta', (data) => {
  let html = '<strong>Resposta:</strong> ' + (data.resposta || '—');
  if (data.fonte) {
    html += '<br><strong>📖 Fonte:</strong> ' + data.fonte;
  }
  if (data.link) {
    html += '<br><strong>🔗 Link:</strong> <a href="' + data.link + '" target="_blank" style="color:#2563eb;word-break:break-all;">' + data.link + '</a>';
  }
  $('respostaSecreta').innerHTML = html;
});

socket.on('resultado', ({ acertou, resposta, fonte, link, jogador, casaFinal }) => {
  $('areaTurno').style.display = 'none';
  $('areaResultado').style.display = 'block';
  $('btnPular').style.display = 'none';

  let html = (acertou ? '✅' : '❌') + ' <strong>' + jogador + '</strong> ' +
    (acertou ? 'acertou' : 'errou') + '!<br>' +
    '<strong>Resposta:</strong> ' + (resposta || '—');

  if (fonte) {
    html += '<br><strong>📖 Fonte:</strong> ' + fonte;
  }
  if (link) {
    html += '<br><strong>🔗 Link:</strong> <a href="' + link + '" target="_blank" style="color:#2563eb;word-break:break-all;">' + link + '</a>';
  }
  html += '<br><strong>Casa final:</strong> ' + casaFinal;

  $('textoResultado').innerHTML = html;
});

socket.on('proximoJogador', () => {
  $('areaResultado').style.display = 'none';
  $('areaTurno').style.display = 'none';
  $('btnIniciarTurno').style.display = 'inline-block';
  $('btnPular').style.display = 'none';
});

// ✅ NOVO: Mensagem final do jogo
socket.on('jogoFinalizado', ({ ranking }) => {
  console.log('🏆 Jogo finalizado!', ranking);

  // Criar modal de resultado
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const conteudo = document.createElement('div');
  conteudo.style.cssText = `
    background: white;
    padding: 40px;
    border-radius: 15px;
    max-width: 600px;
    width: 90%;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  `;

  let rankingHTML = '<h2 style="color: #1e88e5; margin-bottom: 20px;">🏆 PARTIDA ENCERRADA!</h2>';
  rankingHTML += '<div style="text-align: left; margin: 30px 0;">';
  rankingHTML += '<h3 style="color: #333; margin-bottom: 15px;">📊 RESULTADO FINAL:</h3>';

  ranking.forEach((jogador, index) => {
    const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️';
    rankingHTML += `
      <div style="padding: 12px; margin: 8px 0; background: ${index === 0 ? '#fff9e6' : '#f5f5f5'}; border-radius: 8px; border-left: 4px solid ${index === 0 ? '#fdd835' : '#1e88e5'};">
        <strong style="font-size: 18px;">${medalha} ${jogador.nome}</strong><br>
        <span style="color: #43a047;">✅ ${jogador.acertos} acertos</span> | 
        <span style="color: #e53935;">❌ ${jogador.erros} erros</span>
      </div>
    `;
  });

  rankingHTML += '</div>';
  rankingHTML += '<p style="color: #666; font-style: italic; margin-top: 20px;">Parabéns a todos! Cada acerto representa conhecimento conquistado, e cada erro é uma oportunidade de aprender algo novo. Que tal pesquisar sobre as perguntas que mais surpreenderam vocês hoje? O verdadeiro prêmio é a curiosidade que despertamos!</p>';
  rankingHTML += '<button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: #1e88e5; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Novo Jogo</button>';
//Todos vocês expandiram seus horizontes hoje! Lembrem-se: o conhecimento continua além do tabuleiro. Pesquisem, descubram e voltem sempre!
//Parabéns a todos! Cada acerto representa conhecimento conquistado, e cada erro é uma oportunidade de aprender algo novo. Que tal pesquisar sobre as perguntas que mais surpreenderam vocês hoje? O verdadeiro prêmio é a curiosidade que despertamos!
//Não importa a posição no ranking - todos vocês saem mais sábios do que quando começaram. Que descobertas mais marcaram vocês hoje? Compartilhem e continuem aprendendo!

  conteudo.innerHTML = rankingHTML;
  modal.appendChild(conteudo);
  document.body.appendChild(modal);
});

socket.on('jogoEncerrado', () => {
  alert('Jogo encerrado.');
  location.reload();
});

socket.on('erro', (msg) => {
  alert('Erro: ' + msg);
});