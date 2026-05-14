// OCR Viewer Module - renderer.js
/* global window, document, FileReader, setInterval, clearInterval, navigator, Blob, URL */
(function () {
  var R = window.React;
  if (!R) return;
  var useState = R.useState,
    useCallback = R.useCallback,
    useRef = R.useRef,
    useEffect = R.useEffect;
  var e = R.createElement;

  var LANGUAGES = [
    { id: 'original', label: 'Orygina\u0142 (bez zmian)' },
    { id: 'pl', label: 'Polski' },
    { id: 'en', label: 'Angielski' },
    { id: 'de', label: 'Niemiecki' },
    { id: 'fr', label: 'Francuski' },
    { id: 'es', label: 'Hiszpa\u0144ski' },
  ];

  var PROVIDER_NAMES = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    bedrock: 'Bedrock',
    vertex: 'Vertex',
    openrouter: 'OpenRouter',
    litellm: 'LiteLLM',
    azure: 'Azure',
    copilot: 'Copilot',
    nim: 'NVIDIA NIM',
    deepseek: 'DeepSeek',
    groq: 'Groq',
    mistral: 'Mistral',
    fireworks: 'Fireworks',
    xai: 'xAI',
    huggingface: 'HuggingFace',
    moonshot: 'Moonshot',
    zai: 'Z.AI',
    'azure-foundry': 'Azure Foundry',
    'huggingface-local': 'HuggingFace Local',
    'accomplish-ai': 'Accomplish AI',
    minimax: 'MiniMax',
    nebius: 'Nebius',
    together: 'Together',
    venice: 'Venice',
    custom: 'Custom',
  };

  // ---- Simple markdown -> HTML ----
  function mdToHtml(text) {
    if (!text) return '';
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /\*\*\*(.+?)\*\*\*/g,
        '<hr class="my-4 border-border">$1<hr class="my-4 border-border">',
      )
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-4 mb-1">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-2">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/\n/g, '<br>');
    return '<p class="mb-2">' + html + '</p>';
  }

  function providerLabel(pid) {
    if (!pid) return 'Nieznany';
    if (PROVIDER_NAMES[pid]) return PROVIDER_NAMES[pid];
    var lower = String(pid).toLowerCase();
    if (PROVIDER_NAMES[lower]) return PROVIDER_NAMES[lower];
    if (lower.indexOf('custom') >= 0) return 'Custom';
    return pid;
  }

  function Dropdown(props) {
    var options = props.options,
      value = props.value,
      onChange = props.onChange,
      placeholder = props.placeholder || 'Wybierz';
    var _s = useState(false),
      open = _s[0],
      setOpen = _s[1];
    var ref = useRef(null);
    useEffect(
      function () {
        function clickOutside(ev) {
          if (ref.current && !ref.current.contains(ev.target)) setOpen(false);
        }
        if (open) {
          document.addEventListener('mousedown', clickOutside);
          return function () {
            document.removeEventListener('mousedown', clickOutside);
          };
        }
      },
      [open],
    );
    var selected = options.find(function (o) {
      return o.value === value;
    });
    var label = selected ? selected.label : placeholder;
    return e(
      'div',
      { ref: ref, className: 'relative', style: { minWidth: '200px' } },
      e(
        'button',
        {
          className:
            'flex items-center gap-2 text-xs border rounded px-3 py-1.5 bg-background hover:bg-accent w-full justify-between',
          onClick: function () {
            setOpen(!open);
          },
          type: 'button',
        },
        e('span', { className: 'truncate flex-1 text-left' }, label),
        e('span', { className: 'text-muted-foreground flex-shrink-0' }, open ? '\u25B2' : '\u25BC'),
      ),
      open &&
        e(
          'div',
          {
            className:
              'absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-56 overflow-y-auto',
            style: { minWidth: '240px', left: 0 },
          },
          options.map(function (o) {
            return e(
              'button',
              {
                key: o.value,
                className:
                  'block w-full text-left text-xs px-3 py-2 hover:bg-accent truncate ' +
                  (o.value === value ? 'bg-accent font-medium' : ''),
                onClick: function () {
                  onChange(o.value);
                  setOpen(false);
                },
                type: 'button',
              },
              o.label,
            );
          }),
        ),
    );
  }

  function useModelList() {
    var _s = useState([]),
      providers = _s[0],
      setProviders = _s[1];
    useEffect(function () {
      window.nestcafe
        .getProviderSettings()
        .then(function (s) {
          var result = [];
          var src = s && (s.connectedProviders || s.providers);
          if (src) {
            Object.keys(src).forEach(function (pid) {
              var p = src[pid];
              var displayPid = p.providerId || pid;
              var providerName = providerLabel(displayPid);
              if (p.credentials && p.credentials.type === 'custom' && p.credentials.displayName) {
                providerName = p.credentials.displayName;
              }
              var models = [];
              var arr = p.availableModels;
              if (arr && Array.isArray(arr)) {
                arr.forEach(function (m) {
                  if (m.enabled === false) return;
                  var id = m.id || (typeof m === 'string' ? m : '');
                  if (id)
                    models.push({ id: pid + '/' + id, name: m.name || id, value: pid + '/' + id });
                });
              }
              if (
                p.selectedModelId &&
                !models.some(function (x) {
                  return x.value === pid + '/' + p.selectedModelId;
                })
              ) {
                models.push({
                  id: pid + '/' + p.selectedModelId,
                  name: p.selectedModelId,
                  value: pid + '/' + p.selectedModelId,
                });
              }
              if (models.length > 0) result.push({ id: pid, name: providerName, models: models });
            });
          }
          setProviders(result);
        })
        .catch(function () {});
    }, []);
    return providers;
  }

  function ModelDropdown(props) {
    var providers = props.providers,
      value = props.value,
      onChange = props.onChange;
    var _s = useState(false),
      open = _s[0],
      setOpen = _s[1];
    var _h = useState(null),
      hovered = _h[0],
      setHovered = _h[1];
    var ref = useRef(null);
    var currentProv = null,
      currentModel = null;
    providers.forEach(function (pr) {
      pr.models.forEach(function (m) {
        if (m.value === value) {
          currentProv = pr;
          currentModel = m;
        }
      });
    });
    var label = currentModel ? currentModel.name : props.placeholder || 'Wybierz model';
    useEffect(
      function () {
        function clickOutside(ev) {
          if (ref.current && !ref.current.contains(ev.target)) setOpen(false);
        }
        if (open) {
          document.addEventListener('mousedown', clickOutside);
          return function () {
            document.removeEventListener('mousedown', clickOutside);
          };
        }
      },
      [open],
    );
    return e(
      'div',
      { ref: ref, className: 'relative', style: { minWidth: '220px' } },
      e(
        'button',
        {
          className:
            'flex items-center gap-2 text-xs border rounded px-3 py-1.5 bg-background hover:bg-accent w-full justify-between',
          onClick: function () {
            setOpen(!open);
            setHovered(null);
          },
          type: 'button',
        },
        e('span', { className: 'truncate flex-1 text-left' }, label),
        e('span', { className: 'text-muted-foreground flex-shrink-0' }, open ? '\u25B2' : '\u25BC'),
      ),
      open &&
        e(
          'div',
          {
            className:
              'flex absolute z-50 mt-1 bg-popover border rounded-md shadow-md max-h-80 overflow-hidden',
            style: { minWidth: '260px', left: 0 },
          },
          e(
            'div',
            { className: 'flex flex-col w-full max-h-72 overflow-y-auto py-1' },
            currentModel &&
              e(
                'div',
                { className: 'px-3 py-2 text-xs border-b border-border' },
                e(
                  'div',
                  { className: 'text-muted-foreground' },
                  currentProv ? currentProv.name : '',
                ),
                e('div', { className: 'font-medium' }, currentModel.name),
              ),
            providers.map(function (pr) {
              if (pr === currentProv) return null;
              var isHovered = hovered === pr.id;
              return e(
                'button',
                {
                  key: pr.id,
                  className:
                    'flex items-center justify-between w-full text-left text-xs px-3 py-2 hover:bg-accent ' +
                    (isHovered ? 'bg-accent' : ''),
                  onClick: function () {
                    setHovered(isHovered ? null : pr.id);
                  },
                  type: 'button',
                },
                e('span', {}, pr.name),
                e('span', { className: 'text-muted-foreground' }, '\u25B6'),
              );
            }),
            currentProv &&
              currentProv.models.length > 1 &&
              e(
                'div',
                { className: 'border-t border-border mt-1 pt-1' },
                currentProv.models.map(function (m) {
                  return e(
                    'button',
                    {
                      key: m.value,
                      className:
                        'block w-full text-left text-xs px-3 py-2 hover:bg-accent ' +
                        (m.value === value ? 'bg-accent font-medium' : ''),
                      onClick: function () {
                        onChange(m.value);
                        setOpen(false);
                      },
                      type: 'button',
                    },
                    m.name,
                  );
                }),
              ),
          ),
          hovered &&
            e(
              'div',
              {
                className: 'border-l border-border max-h-72 overflow-y-auto py-1',
                style: { minWidth: '180px' },
              },
              (function () {
                var pr = providers.find(function (p) {
                  return p.id === hovered;
                });
                if (!pr) return null;
                return pr.models.map(function (m) {
                  return e(
                    'button',
                    {
                      key: m.value,
                      className:
                        'block w-full text-left text-xs px-3 py-2 hover:bg-accent truncate',
                      onClick: function () {
                        onChange(m.value);
                        setOpen(false);
                        setHovered(null);
                      },
                      type: 'button',
                    },
                    m.name,
                  );
                });
              })(),
            ),
        ),
    );
  }

  // ---- PDF support via pdf.js (local, no internet needed) ----
  function ensurePdfJs(callback) {
    if (window.pdfjsLib) {
      callback();
      return;
    }
    if (document.querySelector('script[data-pdfjs]')) {
      var iv = setInterval(function () {
        if (window.pdfjsLib) {
          clearInterval(iv);
          callback();
        }
      }, 100);
      return;
    }
    var s = document.createElement('script');
    s.src = '/modules/ocr-viewer/pdf.min.js';
    s.dataset.pdfjs = '1';
    s.onload = function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/modules/ocr-viewer/pdf.worker.min.js';
      callback();
    };
    s.onerror = function () {
      // Fallback to CDN if local file missing
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        callback();
      };
    };
    document.head.appendChild(s);
  }

  function renderPdfAllPages(file, pageCallback, doneCallback) {
    ensurePdfJs(function () {
      var reader = new FileReader();
      reader.onload = function () {
        window.pdfjsLib
          .getDocument({ data: reader.result })
          .promise.then(function (pdf) {
            var total = pdf.numPages;
            var results = [];
            var currentPage = 0;
            var cancelled = false;

            function processNext() {
              currentPage++;
              if (currentPage > total || cancelled) {
                if (!cancelled) doneCallback(results.join('\n\n'));
                return;
              }
              pdf
                .getPage(currentPage)
                .then(function (page) {
                  var vp = page.getViewport({ scale: 1.5 });
                  var c = document.createElement('canvas');
                  c.width = vp.width;
                  c.height = vp.height;
                  page
                    .render({ canvasContext: c.getContext('2d'), viewport: vp })
                    .promise.then(function () {
                      var base64 = c.toDataURL('image/png').split(',')[1];
                      pageCallback(
                        currentPage,
                        total,
                        base64,
                        function (text) {
                          results.push('### Strona ' + currentPage + '\n\n' + text);
                          processNext();
                        },
                        function () {
                          cancelled = true;
                          doneCallback(null);
                        },
                      );
                    });
                })
                .catch(function () {
                  cancelled = true;
                  doneCallback(null);
                });
            }
            processNext();
          })
          .catch(function () {
            doneCallback(null);
          });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ---- Line-numbered text render ----
  function renderWithLines(text, onHighlight) {
    if (!text) return null;
    var lines = text.split('\n');
    var digits = String(lines.length).length;
    return e(
      'table',
      { className: 'w-full', style: { borderCollapse: 'collapse' } },
      e(
        'tbody',
        {},
        lines.map(function (line, i) {
          var num = i + 1;
          return e(
            'tr',
            {
              key: i,
              className: 'cursor-pointer hover:bg-yellow-100/30 transition-colors',
              onClick: function () {
                if (onHighlight) onHighlight(num);
              },
              onMouseEnter: function () {
                if (onHighlight) onHighlight(num);
              },
              onMouseLeave: function () {
                if (onHighlight) onHighlight(null);
              },
            },
            e(
              'td',
              {
                className:
                  'text-right pr-3 select-none text-xs font-mono text-muted-foreground border-r border-border align-top',
                style: { width: digits * 10 + 20 + 'px', paddingTop: '2px', paddingBottom: '2px' },
              },
              num,
            ),
            e(
              'td',
              {
                className: 'text-sm pl-3 align-top',
                style: { paddingTop: '2px', paddingBottom: '2px' },
              },
              line || '\u00A0',
            ),
          );
        }),
      ),
    );
  }

  function formatHistoryDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function languageLabel(value) {
    var found = LANGUAGES.find(function (lang) {
      return lang.id === value;
    });
    return found ? found.label.replace(/\s*\(bez zmian\)\s*$/, '') : value || 'Orygina\u0142';
  }

  function OCRViewer() {
    var _s = useState(null),
      image = _s[0],
      setImage = _s[1];
    var _t = useState(''),
      text = _t[0],
      setText = _t[1];
    var _l = useState(false),
      loading = _l[0],
      setLoading = _l[1];
    var _e = useState(null),
      error = _e[0],
      setError = _e[1];
    var _d = useState(false),
      dragOver = _d[0],
      setDragOver = _d[1];
    var _m = useState(''),
      selectedModel = _m[0],
      setSelectedModel = _m[1];
    var _g = useState('original'),
      targetLang = _g[0],
      setTargetLang = _g[1];
    var _c = useState(''),
      chatMsg = _c[0],
      setChatMsg = _c[1];
    var _h = useState([]),
      chatHistory = _h[0],
      setChatHistory = _h[1];
    var _cl = useState(false),
      chatLoading = _cl[0],
      setChatLoading = _cl[1];
    var _z = useState(100),
      zoom = _z[0],
      setZoom = _z[1];
    var _hi = useState([]),
      history = _hi[0],
      setHistory = _hi[1];
    var _hn = useState(''),
      docName = _hn[0],
      setDocName = _hn[1];
    var _sf = useState(null),
      sourceFile = _sf[0],
      setSourceFile = _sf[1];
    var _vw = useState('markdown'),
      viewMode = _vw[0],
      setViewMode = _vw[1];
    var _ln = useState(false),
      lineNumbers = _ln[0],
      setLineNumbers = _ln[1];
    var _hl = useState(null),
      highlightLine = _hl[0],
      setHighlightLine = _hl[1];
    var _hs = useState(false),
      historySession = _hs[0],
      setHistorySession = _hs[1];
    var _px = useState(0),
      panX = _px[0],
      setPanX = _px[1];
    var _py = useState(0),
      panY = _py[0],
      setPanY = _py[1];
    var _dr = useState(false),
      dragging = _dr[0],
      setDragging = _dr[1];
    var _ds = useState({ x: 0, y: 0 }),
      dragStart = _ds[0],
      setDragStart = _ds[1];
    var fileInputRef = useRef(null);
    var models = useModelList();
    var langOptions = LANGUAGES.map(function (l) {
      return { value: l.id, label: l.label };
    });

    useEffect(
      function () {
        if (!dragging) return undefined;

        function handleMove(ev) {
          ev.preventDefault();
          setPanX(ev.clientX - dragStart.x);
          setPanY(ev.clientY - dragStart.y);
        }

        function handleUp() {
          setDragging(false);
        }

        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        return function () {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
        };
      },
      [dragging, dragStart],
    );

    useEffect(function () {
      var modId = window.__module_current_id;
      if (modId) {
        window.nestcafe
          .getModuleSettings(modId)
          .then(function (s) {
            if (s && s.model) setSelectedModel(s.model);
            if (s && s.lang) setTargetLang(s.lang);
            var hist = [];
            Object.keys(s || {}).forEach(function (k) {
              if (k.startsWith('doc_')) {
                try {
                  var item = JSON.parse(s[k]);
                  item._key = k;
                  hist.push(item);
                } catch {
                  // Ignore invalid saved history entries.
                }
              }
            });
            hist.sort(function (a, b) {
              return (b.date || '').localeCompare(a.date || '');
            });
            setHistory(hist.slice(0, 20));
          })
          .catch(function () {
            setHistory([]);
          });
      }
    }, []);

    var saveSetting = useCallback(function (key, val) {
      var modId = window.__module_current_id;
      if (modId) window.nestcafe.setModuleSetting(modId, key, val).catch(function () {});
    }, []);

    var saveToHistory = useCallback(
      function (name, txt, imageDataUrl) {
        var preview = txt.slice(0, 120).replace(/\n/g, ' ');
        var stamp = Date.now();
        var key = 'doc_' + stamp;
        var imageKey = 'docimg_' + stamp;
        var fullImage = imageDataUrl || image || null;
        var entry = {
          _key: key,
          name: name,
          date: new Date().toISOString(),
          preview: preview,
          lang: targetLang,
          text: txt,
          imageKey: fullImage ? imageKey : undefined,
          image: fullImage || undefined,
        };
        setHistory(function (h) {
          return [entry].concat(h).slice(0, 20);
        });
        var modId = window.__module_current_id;
        if (modId) {
          var persisted = Object.assign({}, entry);
          delete persisted.image;
          window.nestcafe
            .setModuleSetting(modId, key, JSON.stringify(persisted))
            .catch(function () {});
          if (fullImage) {
            window.nestcafe.setModuleSetting(modId, imageKey, fullImage).catch(function () {});
          }
        }
      },
      [targetLang, image],
    );

    var openHistoryItem = useCallback(function (item) {
      setText(item.text || '');
      setDocName(item.name);
      setTargetLang(item.lang);
      setSourceFile(null);
      setHistorySession(true);
      setChatHistory([]);
      setZoom(100);
      setPanX(0);
      setPanY(0);
      setError(null);

      if (item.image) {
        setImage(item.image);
        return;
      }

      setImage(null);
      var modId = window.__module_current_id;
      if (!modId || !item.imageKey || !window.nestcafe.getModuleSetting) return;
      window.nestcafe
        .getModuleSetting(modId, item.imageKey)
        .then(function (savedImage) {
          if (savedImage) setImage(savedImage);
        })
        .catch(function () {});
    }, []);

    var deleteHistoryItem = useCallback(function (item) {
      setHistory(function (h) {
        return h.filter(function (x) {
          return x !== item && x._key !== item._key;
        });
      });
      var modId = window.__module_current_id;
      if (modId && item._key) {
        window.nestcafe.setModuleSetting(modId, item._key, '').catch(function () {});
        if (item.imageKey) {
          window.nestcafe.setModuleSetting(modId, item.imageKey, '').catch(function () {});
        }
      }
    }, []);

    var goHome = useCallback(function () {
      setImage(null);
      setText('');
      setError(null);
      setChatHistory([]);
      setZoom(100);
      setPanX(0);
      setPanY(0);
      setDocName('');
      setSourceFile(null);
      setHistorySession(false);
    }, []);

    var getModelParts = useCallback(
      function () {
        if (!selectedModel) return {};
        var idx = selectedModel.indexOf('/');
        if (idx < 0) return {};
        return { providerId: selectedModel.slice(0, idx), modelId: selectedModel.slice(idx + 1) };
      },
      [selectedModel],
    );

    var buildPrompt = useCallback(
      function () {
        var p =
          'Transcribe all text from this document image. Preserve line breaks and paragraphs.';
        if (targetLang !== 'original') {
          var lang = LANGUAGES.find(function (l) {
            return l.id === targetLang;
          });
          p += ' Translate the transcription to ' + (lang ? lang.label : targetLang) + '.';
        }
        p +=
          ' Return ONLY the transcribed text, no commentary. Do not write reasoning or analysis. /no_think';
        return p;
      },
      [targetLang],
    );

    var handleTranscribe = useCallback(
      function (base64, mimeType, name, imageDataUrl) {
        setLoading(true);
        setError(null);
        var parts = getModelParts();
        window.nestcafe
          .visionTranscribe(
            base64,
            mimeType || 'image/png',
            buildPrompt(),
            parts.providerId,
            parts.modelId,
          )
          .then(function (r) {
            if (!r.text || !String(r.text).trim()) {
              setError(
                'Model nie zwr\u00f3ci\u0142 tekstu. Spr\u00f3buj innego modelu lub ponownie.',
              );
              setLoading(false);
              return;
            }
            setText(r.text);
            setLoading(false);
            saveToHistory(name || 'Dokument', r.text, imageDataUrl);
          })
          .catch(function (err) {
            setError(err.message || 'B\u0142\u0105d');
            setLoading(false);
          });
      },
      [getModelParts, buildPrompt, saveToHistory],
    );

    var handleChatCorrect = useCallback(
      function () {
        if (!chatMsg.trim() || !text) return;
        var msg = chatMsg.trim();
        setChatMsg('');
        setChatLoading(true);
        setChatHistory(function (h) {
          return h.concat([{ role: 'user', text: msg }]);
        });
        var parts = getModelParts();
        window.nestcafe
          .visionTranscribe(
            '',
            null,
            '/no_think\nYou are a text editor. User wants to correct a transcribed document. Do not write reasoning or analysis.\n\nCURRENT TEXT:\n"""\n' +
              text +
              '\n"""\n\nUSER REQUEST: ' +
              msg +
              '\n\nReturn the FULL corrected text. Preserve all formatting.',
            parts.providerId,
            parts.modelId,
          )
          .then(function (r) {
            setText(r.text);
            setChatLoading(false);
            setChatHistory(function (h) {
              return h.concat([{ role: 'assistant', text: 'Gotowe.' }]);
            });
          })
          .catch(function (err) {
            setChatLoading(false);
            setChatHistory(function (h) {
              return h.concat([
                { role: 'assistant', text: 'B\u0142\u0105d: ' + (err.message || '') },
              ]);
            });
          });
      },
      [chatMsg, text, getModelParts],
    );

    var processFile = useCallback(
      function (file) {
        if (!file) return;
        setSourceFile(file);
        var name = (file.name || '').toLowerCase();
        var isImage = file.type && file.type.startsWith('image/');
        var isImageExt = /\.(png|jpe?g|webp|bmp)$/i.test(name);
        var isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
        if (!isImage && !isImageExt && !isPdf) {
          setError('Wybierz obraz (PNG/JPG) lub PDF');
          return;
        }
        if (isPdf) {
          setLoading(true);
          setError(null);
          var parts = getModelParts();
          renderPdfAllPages(
            file,
            function (pageNum, total, base64, pageDone, _pageError) {
              window.nestcafe
                .visionTranscribe(
                  base64,
                  'image/png',
                  buildPrompt(),
                  parts.providerId,
                  parts.modelId,
                )
                .then(function (r) {
                  pageDone(r.text);
                })
                .catch(function () {
                  pageDone('[B\u0142\u0105d odczytu strony ' + pageNum + ']');
                });
            },
            function (allText) {
              if (!allText) {
                setError('Nie mo\u017Cna odczyta\u0107 PDF');
                setLoading(false);
                return;
              }
              setText(allText);
              setImage(null);
              setDocName(file.name);
              saveToHistory(file.name, allText);
              setLoading(false);
            },
          );
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var r = reader.result;
          if (typeof r !== 'string') return;
          setImage(r);
          setChatHistory([]);
          setDocName(file.name);
          setHistorySession(false);
          handleTranscribe(r.split(',')[1] || '', file.type || 'image/png', file.name, r);
        };
        reader.readAsDataURL(file);
      },
      [handleTranscribe],
    );

    var handleRetranscribe = useCallback(
      function () {
        setError(null);
        setChatHistory([]);
        if (image) {
          setText('');
          handleTranscribe(image.split(',')[1] || '', 'image/png', docName || 'Dokument', image);
          return;
        }
        if (sourceFile) {
          setText('');
          processFile(sourceFile);
        }
      },
      [image, sourceFile, docName, handleTranscribe, processFile],
    );

    var onDrop = useCallback(
      function (ev) {
        ev.preventDefault();
        setDragOver(false);
        var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (f) processFile(f);
      },
      [processFile],
    );

    // ---- Drop zone ----
    if (!image && !text && !historySession) {
      return e(
        'div',
        {
          className: 'flex h-full items-center justify-center p-8',
          onDrop: onDrop,
          onDragOver: function (ev) {
            ev.preventDefault();
            setDragOver(true);
          },
          onDragLeave: function () {
            setDragOver(false);
          },
        },
        e(
          'div',
          {
            className:
              'flex flex-col items-center gap-4 p-10 rounded-xl border-2 border-dashed max-w-lg w-full ' +
              (dragOver ? 'border-primary bg-primary/5' : 'border-border'),
          },
          e('div', { className: 'text-4xl' }, '\uD83D\uDCC4'),
          e('h3', { className: 'text-lg font-medium' }, 'Wgraj dokument'),
          e('p', { className: 'text-xs text-muted-foreground' }, 'PNG, JPG, PDF'),
          e(
            'div',
            { className: 'flex flex-col gap-2 w-full' },
            e(ModelDropdown, {
              providers: models,
              value: selectedModel,
              onChange: function (v) {
                setSelectedModel(v);
                saveSetting('model', v);
              },
              placeholder: 'Wybierz model AI',
            }),
            e(Dropdown, {
              options: langOptions,
              value: targetLang,
              onChange: function (v) {
                setTargetLang(v);
                saveSetting('lang', v);
              },
              placeholder: 'J\u0119zyk docelowy',
            }),
          ),
          e('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*,.pdf',
            style: { display: 'none' },
            onChange: function (ev) {
              var f = ev.target && ev.target.files && ev.target.files[0];
              if (f) processFile(f);
            },
          }),
          e(
            'button',
            {
              className:
                'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90',
              onClick: function () {
                if (fileInputRef.current) fileInputRef.current.click();
              },
            },
            'Wybierz plik',
          ),
          error && e('p', { className: 'text-sm text-destructive' }, error),
          history.length > 0 &&
            e(
              'div',
              { className: 'w-full mt-4' },
              e(
                'div',
                { className: 'text-xs text-muted-foreground mb-2' },
                'Historia (' + history.length + ')',
              ),
              e(
                'div',
                { className: 'max-h-40 overflow-y-auto space-y-1' },
                history.map(function (h, i) {
                  return e(
                    'div',
                    { key: h._key || i, className: 'flex items-stretch gap-1' },
                    e(
                      'button',
                      {
                        className:
                          'flex-1 text-left text-xs px-3 py-2 rounded hover:bg-accent border min-w-0',
                        onClick: function () {
                          openHistoryItem(h);
                        },
                        type: 'button',
                      },
                      e('div', { className: 'font-medium truncate' }, h.name),
                      e(
                        'div',
                        { className: 'text-muted-foreground truncate' },
                        formatHistoryDate(h.date) + ' \u2022 ' + (h.preview || ''),
                      ),
                    ),
                    e(
                      'button',
                      {
                        className:
                          'text-xs px-3 rounded border text-destructive hover:bg-destructive/10',
                        title: 'Usu\u0144 z historii',
                        onClick: function (ev) {
                          ev.stopPropagation();
                          deleteHistoryItem(h);
                        },
                        type: 'button',
                      },
                      '\u2715',
                    ),
                  );
                }),
              ),
            ),
        ),
      );
    }

    // ---- Loading ----
    if (loading) {
      return e(
        'div',
        { className: 'flex h-full items-center justify-center' },
        e(
          'div',
          { className: 'flex flex-col items-center gap-4' },
          e(
            'div',
            { className: 'flex gap-1' },
            e('div', {
              className: 'h-3 w-3 rounded-full bg-primary',
              style: { animation: 'bounce 1s infinite' },
            }),
            e('div', {
              className: 'h-3 w-3 rounded-full bg-primary',
              style: { animation: 'bounce 1s infinite 150ms' },
            }),
            e('div', {
              className: 'h-3 w-3 rounded-full bg-primary',
              style: { animation: 'bounce 1s infinite 300ms' },
            }),
          ),
          e(
            'p',
            { className: 'text-sm text-muted-foreground' },
            targetLang !== 'original'
              ? 'Transkrybuj\u0119 i t\u0142umacz\u0119...'
              : 'AI transkrybuje...',
          ),
        ),
      );
    }

    // ---- Result + chat ----
    return e(
      'div',
      { className: 'flex flex-col h-full' },
      e(
        'div',
        { className: 'flex flex-1 overflow-hidden' },
        e(
          'div',
          { className: 'flex-1 border-r border-border overflow-auto p-4 bg-muted/20' },
          e(
            'div',
            { className: 'flex items-center justify-between mb-2 gap-2 flex-wrap' },
            e(
              'div',
              { className: 'min-w-0' },
              e('h3', { className: 'text-sm font-medium' }, 'Orygina\u0142'),
              e(
                'div',
                { className: 'text-xs text-muted-foreground truncate' },
                docName || 'Dokument źródłowy',
              ),
            ),
            e(
              'div',
              { className: 'flex gap-1 items-center' },
              e(
                'button',
                {
                  className:
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
                  onClick: function () {
                    setZoom(function (z) {
                      return Math.max(25, z - 25);
                    });
                  },
                },
                '\u2212',
              ),
              e(
                'span',
                { className: 'text-xs text-muted-foreground w-12 text-center font-medium' },
                zoom + '%',
              ),
              e(
                'button',
                {
                  className:
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
                  onClick: function () {
                    setZoom(function (z) {
                      return Math.min(400, z + 25);
                    });
                  },
                },
                '+',
              ),
              e(
                'button',
                {
                  className:
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors ml-1',
                  title: 'Wyśrodkuj obraz bez zmiany powiększenia',
                  onClick: function () {
                    setPanX(0);
                    setPanY(0);
                  },
                },
                '\u2395',
              ),
              e(Dropdown, {
                options: langOptions,
                value: targetLang,
                onChange: function (v) {
                  setTargetLang(v);
                  saveSetting('lang', v);
                  if (image) {
                    setText('');
                    handleTranscribe(image.split(',')[1], 'image/png', docName, image);
                  }
                },
                placeholder: 'J\u0119zyk',
              }),
              e(
                'button',
                {
                  className:
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  onClick: handleRetranscribe,
                  disabled: loading || (!image && !sourceFile),
                  title: 'Transkrybuj ponownie ten sam dokument',
                },
                '\u21bb Ponownie',
              ),
              e(
                'button',
                {
                  className:
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                  onClick: goHome,
                },
                '\u2190 Wr\u00F3\u0107',
              ),
            ),
          ),
          e(
            'div',
            {
              className: 'overflow-hidden',
              style: {
                maxHeight: 'calc(100vh - 120px)',
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
              },
              onMouseDown: function (ev) {
                if (ev.button !== 0) return;
                ev.preventDefault();
                setDragging(true);
                setDragStart({ x: ev.clientX - panX, y: ev.clientY - panY });
              },
              onMouseMove: function (ev) {
                if (!dragging) return;
                ev.preventDefault();
                setPanX(ev.clientX - dragStart.x);
                setPanY(ev.clientY - dragStart.y);
              },
              onMouseUp: function () {
                setDragging(false);
              },
              onMouseLeave: function () {
                // Keep dragging active while the cursor leaves the image pane;
                // the window-level mouseup handler ends the drag.
              },
              onDragStart: function (ev) {
                ev.preventDefault();
              },
              onSelectStart: function (ev) {
                ev.preventDefault();
              },
            },
            highlightLine &&
              lineNumbers &&
              e('div', {
                className:
                  'absolute left-0 right-0 bg-yellow-400/40 border-l-2 border-yellow-500 pointer-events-none z-10',
                style: {
                  height: 100 / Math.max(1, (text || '').split('\n').length) + '%',
                  top:
                    ((highlightLine - 1) / Math.max(1, (text || '').split('\n').length)) * 100 +
                    '%',
                },
              }),
            image
              ? e('img', {
                  src: image,
                  className: 'rounded-lg shadow-md select-none',
                  alt: 'Dokument',
                  style: {
                    width: zoom + '%',
                    maxWidth: 'none',
                    transform: 'translate(' + panX + 'px, ' + panY + 'px)',
                    transition: dragging ? 'none' : 'transform 0.1s',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitUserDrag: 'none',
                  },
                  draggable: false,
                  onDragStart: function (ev) {
                    ev.preventDefault();
                  },
                })
              : e(
                  'div',
                  {
                    className: 'rounded-lg border border-dashed p-6 text-sm text-muted-foreground',
                  },
                  'Podgl\u0105d obrazu niedost\u0119pny dla tej starszej pozycji historii.',
                ),
          ),
        ),
        e(
          'div',
          { className: 'flex-1 flex flex-col overflow-hidden' },
          e(
            'div',
            { className: 'flex items-center justify-between px-4 py-2 border-b border-border' },
            e(
              'div',
              { className: 'flex items-center gap-2' },
              e(
                'div',
                {},
                e('h3', { className: 'text-sm font-medium' }, 'Orygina\u0142'),
                e(
                  'div',
                  { className: 'text-xs text-muted-foreground' },
                  targetLang === 'original'
                    ? 'Bez tłumaczenia'
                    : 'Tłumaczenie: ' + languageLabel(targetLang),
                ),
              ),
              text &&
                e('span', { className: 'text-xs text-muted-foreground' }, text.length + ' zn'),
            ),
            e(ModelDropdown, {
              providers: models,
              value: selectedModel,
              onChange: function (v) {
                setSelectedModel(v);
                saveSetting('model', v);
              },
              placeholder: 'Model',
            }),
          ),
          e(
            'div',
            { className: 'flex-1 overflow-auto p-4' },
            error
              ? e(
                  'div',
                  { className: 'rounded-lg border border-destructive/50 bg-destructive/5 p-4' },
                  e('p', { className: 'text-sm text-destructive' }, error),
                  e(
                    'button',
                    {
                      className: 'mt-2 text-xs underline',
                      onClick: function () {
                        setError(null);
                      },
                    },
                    'Spr\u00F3buj ponownie',
                  ),
                )
              : e(
                  'div',
                  {},
                  text &&
                    e(
                      'div',
                      { className: 'flex gap-2 mb-3 flex-wrap' },
                      e(
                        'button',
                        {
                          className: 'text-xs border rounded px-2 py-1 hover:bg-accent',
                          onClick: function () {
                            navigator.clipboard.writeText(text).catch(function () {});
                          },
                        },
                        '\uD83D\uDCCB Kopiuj',
                      ),
                      e(
                        'button',
                        {
                          className: 'text-xs border rounded px-2 py-1 hover:bg-accent',
                          onClick: function () {
                            var blob = new Blob([text], { type: 'text/plain' });
                            var a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = 'transkrypcja.txt';
                            a.click();
                          },
                        },
                        '\uD83D\uDCC4 .txt',
                      ),
                      e(
                        'button',
                        {
                          className: 'text-xs border rounded px-2 py-1 hover:bg-accent',
                          onClick: function () {
                            var html =
                              '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;padding:40px;}' +
                              'h1{font-size:18pt}h2{font-size:15pt}h3{font-size:13pt}b,strong{font-weight:bold}i,em{font-style:italic}</style></head><body>' +
                              mdToHtml(text) +
                              '</body></html>';
                            var blob = new Blob([html], { type: 'application/msword' });
                            var a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = (docName || 'dokument').replace(/\.[^.]+$/, '') + '.doc';
                            a.click();
                          },
                        },
                        '\uD83D\uDCC3 .doc',
                      ),
                      e('span', { className: 'text-xs text-muted-foreground mx-1 py-1' }, '|'),
                      e(
                        'button',
                        {
                          className:
                            'text-xs border rounded px-2 py-1 ' +
                            (viewMode === 'markdown' ? 'bg-accent' : 'hover:bg-accent'),
                          onClick: function () {
                            setViewMode('markdown');
                          },
                        },
                        'Markdown',
                      ),
                      e(
                        'button',
                        {
                          className:
                            'text-xs border rounded px-2 py-1 ' +
                            (viewMode === 'word' ? 'bg-accent' : 'hover:bg-accent'),
                          onClick: function () {
                            setViewMode('word');
                          },
                        },
                        'Word',
                      ),
                      e(
                        'button',
                        {
                          className:
                            'text-xs border rounded px-2 py-1 ' +
                            (lineNumbers ? 'bg-accent' : 'hover:bg-accent'),
                          onClick: function () {
                            setLineNumbers(!lineNumbers);
                          },
                          title: 'Numeruj wiersze',
                        },
                        '\u2116',
                      ),
                    ),
                  text
                    ? lineNumbers
                      ? renderWithLines(text, setHighlightLine)
                      : viewMode === 'word'
                        ? e(
                            'div',
                            {
                              className: 'max-w-3xl mx-auto bg-white rounded-sm shadow-sm',
                              style: { minHeight: '400px' },
                            },
                            e(
                              'div',
                              {
                                className: 'p-8 text-sm leading-relaxed whitespace-pre-wrap',
                                style: {
                                  fontFamily: 'Georgia, "Times New Roman", serif',
                                  color: '#1a1a1a',
                                },
                              },
                              text,
                            ),
                          )
                        : viewMode === 'markdown'
                          ? e('div', {
                              className: 'text-sm leading-relaxed max-w-none',
                              dangerouslySetInnerHTML: { __html: mdToHtml(text) },
                            })
                          : e(
                              'pre',
                              {
                                className: 'text-sm whitespace-pre-wrap font-sans leading-relaxed',
                              },
                              text,
                            )
                    : e(
                        'p',
                        { className: 'text-sm text-muted-foreground' },
                        'Brak rozpoznanego tekstu.',
                      ),
                ),
          ),
          e(
            'div',
            { className: 'border-t border-border' },
            chatHistory.length > 0 &&
              e(
                'div',
                { className: 'max-h-32 overflow-y-auto px-4 py-2 space-y-1' },
                chatHistory.map(function (h, i) {
                  return e(
                    'div',
                    {
                      key: i,
                      className:
                        'text-xs ' + (h.role === 'user' ? 'text-primary' : 'text-muted-foreground'),
                    },
                    e('span', { className: 'font-medium' }, h.role === 'user' ? 'Ty: ' : 'AI: '),
                    h.text,
                  );
                }),
              ),
            e(
              'div',
              { className: 'flex gap-2 px-4 py-2' },
              e('input', {
                className: 'flex-1 text-xs border rounded px-2 py-1 bg-background',
                placeholder: 'Poprawki np. "zamie\u0144 X na Y w akapicie 3"',
                value: chatMsg,
                onChange: function (ev) {
                  setChatMsg(ev.target.value);
                },
                onKeyDown: function (ev) {
                  if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    handleChatCorrect();
                  }
                },
                disabled: chatLoading || !text,
              }),
              e(
                'button',
                {
                  className:
                    'text-xs rounded bg-primary text-primary-foreground px-3 py-1 disabled:opacity-50',
                  onClick: handleChatCorrect,
                  disabled: chatLoading || !chatMsg.trim() || !text,
                },
                chatLoading ? '...' : 'Popraw',
              ),
            ),
          ),
        ),
      ),
    );
  }

  window.__module_ocr_viewer = OCRViewer;
})();
