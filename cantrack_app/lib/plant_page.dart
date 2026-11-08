import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

class PlantPage extends StatefulWidget {
  final String uuid;
  final void Function(String) onLocate;
  const PlantPage({super.key, required this.uuid, required this.onLocate});
  @override
  State<PlantPage> createState() => _PlantPageState();
}

class _PlantPageState extends State<PlantPage> {
  Map<String, dynamic>? _d;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.instance.plant(widget.uuid);
      if (mounted) setState(() => _d = d);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    }
  }

  Future<void> _act(Future<void> Function() fn, String done) async {
    try {
      await fn();
      if (!mounted) return;
      toast(context, done);
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  Future<void> _remove() async {
    final v = await promptDialog(context, 'Remove this plant?', ['Reason']);
    if (v == null || v[0].length < 3) return;
    await _act(() => Api.instance.removePlant(widget.uuid, v[0]), 'Plant removed');
  }

  Future<void> _correct() async {
    final v = await promptDialog(context, 'Correct location', ['Position ID (e.g. L1-P01-C03-R27)', 'Reason']);
    if (v == null || v[0].isEmpty || v[1].length < 3) return;
    await _act(() => Api.instance.correct(widget.uuid, v[0].toUpperCase(), v[1]), 'Location corrected');
  }

  @override
  Widget build(BuildContext context) {
    final user = Api.instance.user!;
    final d = _d;
    Widget body;
    if (_err != null) {
      body = ErrorView(message: _err!, onRetry: _load);
    } else if (d == null) {
      body = const Loading();
    } else {
      final p = d['plant'] as Map<String, dynamic>;
      final history = (d['history'] as List<dynamic>).cast<Map<String, dynamic>>();
      final status = (d['status_history'] as List<dynamic>).cast<Map<String, dynamic>>();
      final active = p['status'] == 'active';
      final pos = p['position'] as String?;
      body = ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${p['gid']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: kLime)),
            const SizedBox(height: 8),
            label('Status', '${p['status']}'),
            label('Plant ID', '${p['uuid']}'),
            label('Sown', '${fmtDay(p['sown_date'])}  ·  age ${p['age_days'] ?? '—'} days'),
            label('Created', '${fmtDate(p['created_at'])}${p['created_by'] != null ? ' by ${p['created_by']}' : ''}'),
            if (p['phenomeone_id'] != null) label('PhenomeOne', '${p['phenomeone_id']}'),
            if (infoText(p['info']).isNotEmpty) label('Genotype', infoText(p['info'])),
            if (pos != null) ...[
              label('Position', pos),
              FilledButton.tonal(
                onPressed: () {
                  Navigator.pop(context);
                  widget.onLocate(pos);
                },
                child: const Text('Show on map'),
              ),
            ],
          ]),
        ),
        if (active && (user.canCorrect || user.canRemove))
          Row(children: [
            if (user.canCorrect) Expanded(child: OutlinedButton(onPressed: _correct, child: const Text('Correct location'))),
            if (user.canCorrect && user.canRemove) const SizedBox(width: 12),
            if (user.canRemove) Expanded(child: OutlinedButton(onPressed: _remove, style: OutlinedButton.styleFrom(foregroundColor: kRed), child: const Text('Remove plant'))),
          ]),
        heading('Location history'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final m in history)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('${fmtDate(m['moved_at'])}\n→ ${m['position_id']} · ${m['by']} · ${m['source']}${m['kind'] == 'correction' ? '\n✏️ correction: ${m['reason']}' : ''}',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.white70)),
              ),
          ]),
        ),
        if (status.isNotEmpty) ...[
          heading('Status history'),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final s in status)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('${fmtDate(s['at'])}\n${s['from_status']} → ${s['to_status']} · ${s['by']} · ${s['reason']}',
                      style: const TextStyle(fontSize: 12, color: Colors.white70)),
                ),
            ]),
          ),
        ],
      ]);
    }
    return Scaffold(appBar: AppBar(title: const Text('Plant'), backgroundColor: kBg), body: body);
  }
}

class GenotypePage extends StatefulWidget {
  final String gid;
  final void Function(String) onLocate;
  const GenotypePage({super.key, required this.gid, required this.onLocate});
  @override
  State<GenotypePage> createState() => _GenotypePageState();
}

class _GenotypePageState extends State<GenotypePage> {
  late final Future<Map<String, dynamic>> _f = Api.instance.genotype(widget.gid);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.gid), backgroundColor: kBg),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _f,
        builder: (context, snap) {
          if (snap.hasError) return ErrorView(message: '${snap.error}');
          if (!snap.hasData) return const Loading();
          final g = snap.data!['genotype'] as Map<String, dynamic>;
          final plants = (snap.data!['plants'] as List<dynamic>).cast<Map<String, dynamic>>();
          return ListView(padding: const EdgeInsets.all(16), children: [
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${g['gid']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: kLime)),
                const SizedBox(height: 8),
                label('PhenomeOne ID', '${g['phenomeone_id'] ?? '—'}'),
                if (infoText(g['info']).isNotEmpty) label('Parentage / details', infoText(g['info'])),
              ]),
            ),
            heading('${plants.length} physical plant(s)'),
            for (final p in plants)
              AppCard(
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PlantPage(uuid: p['uuid'] as String, onLocate: widget.onLocate))),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${p['position'] ?? 'removed'}', style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700, color: p['position'] == null ? kRed : kLime)),
                      Text('${(p['uuid'] as String).substring(0, 13)}… · ${p['status']} · age ${p['age_days'] ?? '—'} d', style: const TextStyle(fontSize: 12, color: Colors.white54)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right),
                ]),
              ),
          ]);
        },
      ),
    );
  }
}
