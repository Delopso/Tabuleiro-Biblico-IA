document.addEventListener('DOMContentLoaded', function() {
  console.log('🎮 Página do jogador carregada');
  
  if (typeof io === 'undefined') {
    console.error('❌ Socket.io não carregado!');
    alert('Erro: Socket.io não carregado.');
    return;
  }

  const socket = io();
  console.log('🔌 Conectando...');
  
  let meuId = null;
  let jogadores = [];

  const btnEntrar = document.getElementById('btnEntrar');
  const inputCodigo = document.getElementById('codigoSala');
  const inputNome = document.getElementById('nomeJogador');
  const divErro = document.getElementById('erro');
  const divLogin = document.getElementById('login');
  const divJogo = document.getElementById('jogo');
  const divAreaPergunta = document.getElementById('areaPergunta');

  if (!btnEntrar || !inputCodigo || !inputNome) {
    console.error('❌ Elementos não encontrados!');
    return;
  }

  btnEntrar.addEventListener('click', function() {
    const codigo = inputCodigo.value.trim().toUpperCase();
    const nome = inputNome.value.trim();
    
    if (!codigo) {
      divErro.textContent = 'Digite o código da sala.';
      divErro.style.display = 'block';
      return;
    }
    if (!nome) {
      divErro.textContent = 'Digite seu nome.';
      divErro.style.display = 'block';
      return;
    }
    
    divErro.style.display = 'none';
    socket.emit('entrarSala', { codigo, nome });
  });

  inputNome.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') btnEntrar.click();
  });

  socket.on('erro', function(msg) {
    divErro.textContent = msg;
    divErro.style.display = 'block';
  });

  socket.on('entradaOk', function(data) {
    console.log('✅ Entrada OK! ID:', data.jogadorId);
    meuId = data.jogadorId;
    divLogin.style.display = 'none';
    divJogo.style.display = 'block';
  });

  // ===== TABULEIRO COM IMAGEM =====
  function atualizarTabuleiroImagem() {
    const container = document.getElementById('tabuleiroImagem');
    if (!container) return;
    
    container.querySelectorAll('.peca-jogador').forEach(p => p.remove());
    
    jogadores.forEach(j => {
      if (j.casa <= 0) return;
      const coords = getCoordenadaCasa(j.casa);
      const peca = document.createElement('div');
      const corIndex = (j.id % 6) + 1;
      peca.className = `peca-jogador peca-jogador-${corIndex}`;
      peca.style.left = coords.x + '%';
      peca.style.top = coords.y + '%';
      peca.title = j.nome + ' (Casa ' + j.casa + ')';
      container.appendChild(peca);
    });
  }

  function gerarLegenda() {
    const legenda = document.getElementById('legenda');
    if (!legenda) return;
    
    const cores = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00'];
    legenda.innerHTML = jogadores.map((j, i) => 
      `<div class="legenda-item"> 
        <div class="legenda-cor" style="background:${cores[i % cores.length]}"></div> 
        <span>${j.nome}${j.id === meuId ? ' (você)' : ''}</span> 
      </div>`
    ).join('');
  }

  socket.on('jogadoresAtualizados', function(lista) {
    console.log('👥 Jogadores atualizados:', lista);
    jogadores = lista;
    
    const divMinhaCasa = document.getElementById('minhaCasa');
    const divPlacar = document.getElementById('placar');
    
    if (divMinhaCasa) {
      const eu = lista.find(j => j.id === meuId);
      if (eu) divMinhaCasa.textContent = eu.casa;
    }
    
    if (divPlacar) {
      divPlacar.innerHTML = '<h4>Placar</h4>' +
        lista.map(j => '<div class="jogador-placar ' + (j.id === meuId ? 'eu' : '') + '">' +
          j.nome + ': casa ' + j.casa + '</div>').join('');
    }
    
    gerarLegenda();
    atualizarTabuleiroImagem();
  });

  socket.on('turnoIniciado', function(data) {
    console.log('🎯 Turno iniciado:', data);
    
    // ✅ NOVO: Mostrar o dado
    const divDado = document.getElementById('resultadoDado');
    const imgDado = document.getElementById('imgDado');
    const numDado = document.getElementById('numDado');
    if (divDado && imgDado && numDado) {
      imgDado.src = `/images/dado${data.dado}.png`;
      numDado.textContent = data.dado;
      divDado.style.display = 'flex';
    }

    if (divAreaPergunta) {
      divAreaPergunta.style.display = 'block';
      const nomeQuemJoga = document.getElementById('nomeQuemJoga');
      const textoPergunta = document.getElementById('textoPergunta');
      const textoResposta = document.getElementById('textoResposta');
      const resultadoTexto = document.getElementById('resultadoTexto');
      
      if (nomeQuemJoga) nomeQuemJoga.textContent = data.jogador;
      
      if (data.semPergunta) {
        if (textoPergunta) {
          textoPergunta.textContent =
            '🎲 Dado: ' + data.dado + '\n' +
            '📍 Casa: ' + data.casa + '\n\n' +
            '⚠️ Não há pergunta para esta casa.\n' +
            'O jogador permanece na casa ' + data.casa + '.';
        }
        if (textoResposta) textoResposta.style.display = 'none';
        if (resultadoTexto) resultadoTexto.textContent = 'Aguardando o moderador passar a vez...';
      } else {
        if (textoPergunta) textoPergunta.textContent = data.pergunta ? data.pergunta.texto : 'Sem pergunta.';
        if (textoResposta) textoResposta.style.display = 'none';
        if (resultadoTexto) resultadoTexto.textContent = '';
      }
    }
  });

  socket.on('resultado', function(data) {
    console.log('📊 Resultado:', data);
    const textoResposta = document.getElementById('textoResposta');
    const resultadoTexto = document.getElementById('resultadoTexto');
    
    if (textoResposta) {
      let html = '<strong>Resposta:</strong> ' + (data.resposta || '—');
      if (data.fonte) {
        html += '<br><strong>📖 Fonte:</strong> ' + data.fonte;
      }
      if (data.link) {
        html += '<br><strong>🔗 Link:</strong> <a href="' + data.link + '" target="_blank" style="color:#2563eb;word-break:break-all;">' + data.link + '</a>';
      }
      textoResposta.innerHTML = html;
      textoResposta.style.display = 'block';
    }
    
    if (resultadoTexto) {
      resultadoTexto.innerHTML = data.jogador + ' ' +
        (data.acertou ? '✅ acertou' : '❌ errou') + '! Casa: ' + data.casaFinal;
    }
  });

  socket.on('proximoJogador', function() {
    console.log('️ Próximo jogador');
    
    // ✅ NOVO: Esconder o dado
    const divDado = document.getElementById('resultadoDado');
    if (divDado) divDado.style.display = 'none';

    if (divAreaPergunta) divAreaPergunta.style.display = 'none';
  });

  // ✅ Mensagem final do jogo
  socket.on('jogoFinalizado', function({ ranking }) {
    console.log('🏆 Jogo finalizado!', ranking);
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8); display: flex; align-items: center;
      justify-content: center; z-index: 9999;
    `;
    
    const conteudo = document.createElement('div');
    conteudo.style.cssText = `
      background: white; padding: 40px; border-radius: 15px;
      max-width: 600px; width: 90%; text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    
    let rankingHTML = '<h2 style="color: #1e88e5; margin-bottom: 20px;">🏆 PARTIDA ENCERRADA!</h2>';
    rankingHTML += '<div style="text-align: left; margin: 30px 0;">';
    rankingHTML += '<h3 style="color: #333; margin-bottom: 15px;">📊 RESULTADO FINAL:</h3>';
    
    ranking.forEach((jogador, index) => {
      const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️';
      const destaque = jogador.nome === ranking.find(j => j.id === meuId)?.nome ? 'border: 2px solid #1e88e5;' : '';
      rankingHTML += `
        <div style="padding: 12px; margin: 8px 0; background: ${index === 0 ? '#fff9e6' : '#f5f5f5'}; border-radius: 8px; border-left: 4px solid ${index === 0 ? '#fdd835' : '#1e88e5'}; ${destaque}">
          <strong style="font-size: 18px;">${medalha} ${jogador.nome}</strong><br>
          <span style="color: #43a047;">✅ ${jogador.acertos} acertos</span> | 
          <span style="color: #e53935;">❌ ${jogador.erros} erros</span>
        </div>
      `;
    });
    
    rankingHTML += '</div>';
    rankingHTML += '<p style="color: #666; font-style: italic; margin-top: 20px;">Parabéns a todos! Cada acerto representa conhecimento conquistado, e cada erro é uma oportunidade de aprender algo novo.</p>';
    rankingHTML += '<button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: #1e88e5; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Voltar ao Início</button>';
    
    conteudo.innerHTML = rankingHTML;
    modal.appendChild(conteudo);
    document.body.appendChild(modal);
  });

  socket.on('jogoEncerrado', function() {
    console.log('🔚 Jogo encerrado');
    alert('O moderador encerrou o jogo.');
    location.reload();
  });

  socket.on('connect', function() {
    console.log('✅ Conectado ao servidor! ID:', socket.id);
  });

  socket.on('disconnect', function() {
    console.log('❌ Desconectado do servidor.');
  });

  socket.on('connect_error', function(err) {
    console.error('❌ Erro de conexão:', err);
    divErro.textContent = 'Erro de conexão com o servidor. Verifique se o servidor está rodando.';
    divErro.style.display = 'block';
  });
});